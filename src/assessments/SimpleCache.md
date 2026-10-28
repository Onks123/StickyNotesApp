## Code Review

You are reviewing the following code submitted as part of a task to implement an item cache in a highly concurrent application. The anticipated load includes: thousands of reads per second, hundreds of writes per second, tens of concurrent threads.
Your objective is to identify and explain the issues in the implementation that must be addressed before deploying the code to production. Please provide a clear explanation of each issue and its potential impact on production behaviour.

```kotlin
import java.util.concurrent.ConcurrentHashMap

class SimpleCache<K, V> {
    private val cache = ConcurrentHashMap<K, CacheEntry<V>>()
    private val ttlMs = 60000 // 1 minute
    
    data class CacheEntry<V>(val value: V, val timestamp: Long)
    
    fun put(key: K, value: V) {
        cache[key] = CacheEntry(value, System.currentTimeMillis())
    }
    
    fun get(key: K): V? {
        val entry = cache[key]
        if (entry != null) {
            if (System.currentTimeMillis() - entry.timestamp < ttlMs) {
                return entry.value
            }
        }
        return null
    }
    
    fun size(): Int {
        return cache.size
    }
}
```

---

## Review

### Summary

The basic choice is sound. `ConcurrentHashMap` is the right map, single `get` and `put` calls are thread-safe, and `CacheEntry` is immutable so it is safely published between threads. Reading the entry once into a local `entry` also avoids a check-then-read race.

The problems are about lifecycle, not locking. Expired data is never removed, memory is unbounded, and the API pushes callers into a racy "get, miss, load, put" pattern. At the stated load these will cause outages, so issues 1 to 5 are blockers.

| # | Issue | Severity |
|---|-------|----------|
| 1 | Expired entries are never removed (memory leak) | Blocker |
| 2 | No maximum size or eviction policy | Blocker |
| 3 | No atomic get-or-load (cache stampede) | Blocker |
| 4 | Wall-clock time used for TTL | Blocker |
| 5 | `size()` reports expired entries | High |
| 6 | Null keys and null values | High |
| 7 | No way to invalidate or clear | High |
| 8 | Hard-coded TTL, and every entry expires on the same schedule | Medium |
| 9 | No metrics | Medium |
| 10 | Smaller points | Low |

---

### 1. Expired entries are never removed (Blocker)

`get` checks the TTL and returns `null`, but leaves the entry in the map. Nothing else ever removes anything.

**Impact.** Every distinct key ever written stays in memory forever. At hundreds of writes per second with a growing key space (user IDs, session IDs, request params), heap usage climbs steadily. GC pauses get longer as the old generation fills, latency degrades, and eventually the service fails with `OutOfMemoryError`. This tends to show up days after deployment, which makes it hard to link back to the change.

**Fix.** Remove expired entries lazily on read with `map.remove(key, entry)`. The two-argument form only removes if the mapping is still that exact entry, so it cannot delete a fresh value another thread just wrote. Also run a periodic background sweep, because keys that are never read again would otherwise never be cleaned up.

### 2. No maximum size or eviction policy (Blocker)

Even with expiry fixed, size is limited only by how many distinct keys are written in one TTL window.

**Impact.** A traffic spike, a bot hitting random URLs, or a caller using a high-cardinality key can fill the heap within the 60-second window. Memory use is driven by input the service does not control.

**Fix.** Set a maximum size with an eviction policy (LRU, or better, Caffeine's W-TinyLFU). Doing this correctly and quickly under concurrency is hard, which is the main reason to use Caffeine rather than a hand-rolled cache.

### 3. No atomic get-or-load, so a cache stampede is likely (Blocker)

The only way to use this cache is:

```kotlin
val v = cache.get(key) ?: loadFromDb(key).also { cache.put(key, it) }
```

That is check-then-act. It is not atomic.

**Impact.**
- **Stampede.** When a hot key expires, every thread that reads it in the next moment misses. With tens of threads and thousands of reads per second, dozens of identical calls hit the database at once. This happens every 60 seconds for every hot key, and it is a classic cause of downstream overload.
- **Stale overwrite.** Thread A starts a slow load. Thread B loads newer data and puts it. Thread A finishes and overwrites B's fresher value with its older one.

**Fix.** Provide `getOrLoad(key, loader)` built on `ConcurrentHashMap.compute`, so only one thread loads a given key and the others wait for its result. Caffeine's `LoadingCache.get` does this out of the box.

### 4. Wall-clock time used for TTL (Blocker)

`System.currentTimeMillis()` is wall-clock time. NTP corrections, VM migrations, and manual changes can move it backwards or forwards.

**Impact.**
- **Clock moves back.** `now - timestamp` becomes small or negative, and a negative value still passes `< ttlMs`. Entries are served well past their TTL, so users see stale data.
- **Clock moves forward.** Every entry looks expired at once. The whole cache misses together, and combined with issue 3 that is a stampede across every key at the same moment.

**Fix.** Use `System.nanoTime()`, which is monotonic. Compare with subtraction (`now - expiresAt >= 0`) so it stays correct even if the value overflows. Make the clock injectable so TTL behaviour can be unit tested without sleeping.

### 5. `size()` is misleading (High)

It returns `cache.size`, which includes every expired entry that is still in the map.

**Impact.** Any dashboard, alert, or capacity logic built on it is wrong, and the error grows over time because of issue 1. Engineers debugging an incident will be misled by it.

**Fix.** Once expired entries are actually removed this becomes close to accurate. Name it something like `estimatedSize()` to make clear it is approximate under concurrency.

### 6. Null keys and null values (High)

`K` and `V` have no bounds, so they can be nullable types.

**Impact.**
- `ConcurrentHashMap` rejects null keys. `SimpleCache<String?, X>` compiles, then throws `NullPointerException` at runtime on `put(null, ...)`.
- A cached `null` value is wrapped in `CacheEntry`, so it is stored. But `get` then returns `null`, which looks exactly like a miss. Callers reload every time. Any "not found" result that should be cached will hit the backend on every request.

**Fix.** Declare `K : Any, V : Any`. If "not found" should be cached, use an explicit wrapper (for example `Optional`) or a sentinel value.

### 7. No way to invalidate or clear (High)

There is no `remove` or `clear`.

**Impact.** When the underlying data changes (a price update, a revoked permission), the cache keeps serving the old value for up to a minute and nothing can stop it. In an incident there is no way to flush bad data short of restarting the service.

**Fix.** Add `invalidate(key)` and `invalidateAll()`.

### 8. Hard-coded TTL, and synchronised expiry (Medium)

The TTL is a private constant, an `Int` of milliseconds.

**Impact.** Different data needs different freshness, and changing it means a code change and redeploy. Also, entries written together (for example at start-up or after a flush) all expire together, which produces regular load spikes.

**Fix.** Take the TTL as a constructor parameter, ideally a `Duration`. Consider adding a small random jitter to each entry's expiry to spread reloads out.

### 9. No metrics (Medium)

There is no hit, miss, or eviction count.

**Impact.** You cannot tell if the cache is working. A hit rate of 5% means it is mostly overhead. Problems only become visible through downstream load.

**Fix.** Count hits, misses, loads and evictions, and export them (Caffeine's `recordStats()` does this).

### 10. Smaller points (Low)

- `CacheEntry` is a public `data class`. That leaks an internal type into the public API, and the generated `toString()` will print cached values if an entry is ever logged, which matters if the values are personal or sensitive data.
- Storing `expiresAt` instead of the creation time means each read does one comparison and makes per-entry TTLs easy later.
- If `V` is mutable, every thread shares the same instance. One caller mutating it changes what everyone else sees. Prefer immutable values or document the contract.
- There are no tests, in particular none for expiry, concurrency, or clock behaviour.

---

## Recommendation

Replace the class with Caffeine, which solves issues 1 to 9 in a few lines and is the standard JVM choice:

```kotlin
val cache: LoadingCache<K, V> = Caffeine.newBuilder()
    .maximumSize(100_000)
    .expireAfterWrite(Duration.ofMinutes(1))
    .recordStats()
    .build { key -> loadFromSource(key) }
```

If a dependency is not allowed, `SimpleCache.kt` alongside this review contains a hand-written `TtlCache` that fixes issues 1 and 3 to 10, with tests for each. It intentionally leaves out size-based eviction (issue 2), because that is the part most worth taking from a library.

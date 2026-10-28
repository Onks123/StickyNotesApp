import kotlin.test.*

// The task:
// 1. Read and understand the Hierarchy data structure described in this file.
// 2. Implement filter() function.
// 3. Implement more test cases.
//
// The task should take 30-90 minutes.
//
// When assessing the submission, we will pay attention to:
// - correctness, efficiency, and clarity of the code;
// - the test cases.

/**
 * A `Hierarchy` stores an arbitrary _forest_ (an ordered collection of ordered trees)
 * as an array of node IDs in the order of DFS traversal, combined with a parallel array of node depths.
 *
 * Parent-child relationships are identified by the position in the array and the associated depth.
 * Each tree root has depth 0, its children have depth 1 and follow it in the array, their children have depth 2 and follow them, etc.
 *
 * Example:
 * ```
 * nodeIds: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
 * depths:  0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2
 * ```
 *
 * the forest can be visualized as follows:
 * ```
 * 1
 * - 2
 * - - 3
 * - - - 4
 * - 5
 * 6
 * - 7
 * 8
 * - 9
 * - 10
 * - - 11
 *```
 * 1 is a parent of 2 and 5, 2 is a parent of 3, etc. Note that depth is equal to the number of hyphens for each node.
 *
 * Invariants on the depths array:
 *  * Depth of the first element is 0.
 *  * If the depth of a node is `D`, the depth of the next node in the array can be:
 *      * `D + 1` if the next node is a child of this node;
 *      * `D` if the next node is a sibling of this node;
 *      * `d < D` - in this case the next node is not related to this node.
 */
interface Hierarchy {
  /** The number of nodes in the hierarchy. */
  val size: Int

  /**
   * Returns the unique ID of the node identified by the hierarchy index. The depth for this node will be `depth(index)`.
   * @param index must be non-negative and less than [size]
   * */
  fun nodeId(index: Int): Int

  /**
   * Returns the depth of the node identified by the hierarchy index. The unique ID for this node will be `nodeId(index)`.
   * @param index must be non-negative and less than [size]
   * */
  fun depth(index: Int): Int

  fun formatString(): String {
    return (0 until size).joinToString(
      separator = ", ",
      prefix = "[",
      postfix = "]"
    ) { i -> "${nodeId(i)}:${depth(i)}" }
  }
}

/**
 * A node is present in the filtered hierarchy iff its node ID passes the predicate and all of its ancestors pass it as well.
 *
 * Approach: a single forward pass over the DFS order.
 *
 * Because nodes are stored in DFS order, every descendant of a node appears
 * directly after it, as a contiguous run of nodes with a greater depth.
 * So when a node fails the predicate, we remember its depth and skip every
 * following node that is deeper than that. The first node at the same depth
 * or shallower is outside the rejected subtree, so we stop skipping there.
 *
 * Depths never need to be recalculated. A node is only kept when all of its
 * ancestors are kept too, so its depth in the result is the same as in the input.
 * This also means the result automatically satisfies the depth invariants.
 *
 * Complexity:
 *  - Time: O(n). Each node is visited once.
 *  - Extra space: O(n) for the result arrays. Primitive IntArrays avoid boxing.
 *  - The predicate is never called for nodes inside a rejected subtree,
 *    which matters if the predicate is expensive.
 */
fun Hierarchy.filter(nodeIdPredicate: (Int) -> Boolean): Hierarchy {
  // Pre-size to the worst case (everything kept), then trim at the end.
  // This avoids growable lists of boxed Integers.
  val keptIds = IntArray(size)
  val keptDepths = IntArray(size)
  var keptCount = 0

  // Depth of the root of the subtree we are currently skipping.
  // NOT_SKIPPING means we are not inside a rejected subtree.
  var skipBelowDepth = NOT_SKIPPING

  for (i in 0 until size) {
    val depth = depth(i)

    // Still inside a rejected subtree: drop without calling the predicate.
    if (depth > skipBelowDepth) continue

    // We have left any rejected subtree (or were never in one).
    // All ancestors of this node have passed, so only the node itself needs checking.
    skipBelowDepth = NOT_SKIPPING

    val id = nodeId(i)
    if (nodeIdPredicate(id)) {
      keptIds[keptCount] = id
      keptDepths[keptCount] = depth
      keptCount++
    } else {
      // Reject this node and, implicitly, all of its descendants.
      skipBelowDepth = depth
    }
  }

  return ArrayBasedHierarchy(keptIds.copyOf(keptCount), keptDepths.copyOf(keptCount))
}

// Any real depth is smaller than this, so "depth > NOT_SKIPPING" is never true.
private const val NOT_SKIPPING = Int.MAX_VALUE

class ArrayBasedHierarchy(
  private val myNodeIds: IntArray,
  private val myDepths: IntArray,
) : Hierarchy {
  override val size: Int = myDepths.size

  override fun nodeId(index: Int): Int = myNodeIds[index]

  override fun depth(index: Int): Int = myDepths[index]
}

class FilterTest {

  // Shared example from the Hierarchy KDoc.
  //
  // 1
  // - 2
  // - - 3
  // - - - 4
  // - 5
  // 6
  // - 7
  // 8
  // - 9
  // - 10
  // - - 11
  private val example: Hierarchy = hierarchy(
    ids = intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
    depths = intArrayOf(0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2),
  )

  @Test
  fun testFilter() {
    val unfiltered: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
      intArrayOf(0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2))
    val filteredActual: Hierarchy = unfiltered.filter { nodeId -> nodeId % 3 != 0 }
    val filteredExpected: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 5, 8, 10, 11),
      intArrayOf(0, 1, 1, 0, 1, 2))
    assertEquals(filteredExpected.formatString(), filteredActual.formatString())
  }

  // ---- Edge cases ----

  @Test
  fun emptyHierarchyStaysEmpty() {
    val result = hierarchy(intArrayOf(), intArrayOf()).filter { true }
    assertEquals(0, result.size)
    assertEquals("[]", result.formatString())
  }

  @Test
  fun singleNodeKeptWhenItPasses() {
    assertFiltered(hierarchy(intArrayOf(42), intArrayOf(0)), "[42:0]") { true }
  }

  @Test
  fun singleNodeRemovedWhenItFails() {
    assertFiltered(hierarchy(intArrayOf(42), intArrayOf(0)), "[]") { false }
  }

  @Test
  fun predicateAcceptingEverythingReturnsSameHierarchy() {
    assertFiltered(example, example.formatString()) { true }
  }

  @Test
  fun predicateRejectingEverythingReturnsEmptyHierarchy() {
    assertFiltered(example, "[]") { false }
  }

  // ---- Ancestor rule ----

  @Test
  fun rejectingRootRemovesWholeTreeButKeepsOtherTrees() {
    // Rejecting 1 removes 2, 3, 4, 5. Trees rooted at 6 and 8 are untouched.
    assertFiltered(example, "[6:0, 7:1, 8:0, 9:1, 10:1, 11:2]") { it != 1 }
  }

  @Test
  fun rejectingMiddleNodeRemovesOnlyItsSubtree() {
    // Rejecting 2 removes 3 and 4. Its sibling 5 must survive.
    assertFiltered(example, "[1:0, 5:1, 6:0, 7:1, 8:0, 9:1, 10:1, 11:2]") { it != 2 }
  }

  @Test
  fun rejectingLeafRemovesOnlyThatLeaf() {
    assertFiltered(example, "[1:0, 2:1, 3:2, 5:1, 6:0, 7:1, 8:0, 9:1, 10:1, 11:2]") { it != 4 }
  }

  @Test
  fun rejectingLastNodeWorks() {
    assertFiltered(example, "[1:0, 2:1, 3:2, 4:3, 5:1, 6:0, 7:1, 8:0, 9:1, 10:1]") { it != 11 }
  }

  @Test
  fun passingNodeUnderRejectedAncestorIsRemoved() {
    // 4 passes but its grandparent 2 fails, so 4 must not appear.
    val kept = setOf(1, 4, 5)
    assertFiltered(example, "[1:0, 5:1]") { it in kept }
  }

  @Test
  fun skippingStopsAtShallowerNodeAfterDeepRejectedSubtree() {
    // Reject 3 (depth 2). The next node 5 is at depth 1, two levels up from 4.
    // It must be kept even though the depth drops by more than one.
    assertFiltered(example, "[1:0, 2:1, 5:1, 6:0, 7:1, 8:0, 9:1, 10:1, 11:2]") { it != 3 }
  }

  @Test
  fun rejectedSiblingsInARowAreEachHandled() {
    // Siblings 9 and 10 both fail. 11 is under 10, so it goes too.
    assertFiltered(example, "[1:0, 2:1, 3:2, 4:3, 5:1, 6:0, 7:1, 8:0]") { it != 9 && it != 10 }
  }

  @Test
  fun deepChainCutInTheMiddle() {
    // 1 > 2 > 3 > 4 > 5, then a new root 6.
    val chain = hierarchy(intArrayOf(1, 2, 3, 4, 5, 6), intArrayOf(0, 1, 2, 3, 4, 0))
    assertFiltered(chain, "[1:0, 2:1, 6:0]") { it != 3 }
  }

  @Test
  fun worksWhenNodeIdsAreNotInAscendingOrder() {
    // The algorithm must rely on position and depth, never on ID ordering.
    val shuffled = hierarchy(intArrayOf(50, 7, 99, 3, 20), intArrayOf(0, 1, 2, 1, 0))
    assertFiltered(shuffled, "[50:0, 3:1, 20:0]") { it != 7 }
  }

  @Test
  fun flatForestOfRootsOnly() {
    val roots = hierarchy(intArrayOf(1, 2, 3, 4), intArrayOf(0, 0, 0, 0))
    assertFiltered(roots, "[1:0, 3:0]") { it % 2 == 1 }
  }

  // ---- Behaviour and efficiency ----

  @Test
  fun predicateIsNotCalledForNodesInsideRejectedSubtree() {
    val seen = mutableListOf<Int>()
    example.filter { id ->
      seen += id
      id != 2 && id != 8
    }
    // 3 and 4 sit under 2. 9, 10 and 11 sit under 8. None should be evaluated.
    assertEquals(listOf(1, 2, 5, 6, 7, 8), seen)
  }

  @Test
  fun originalHierarchyIsNotModified() {
    val before = example.formatString()
    example.filter { it % 2 == 0 }
    assertEquals(before, example.formatString())
  }

  @Test
  fun resultCanBeFilteredAgain() {
    val result = example.filter { it != 2 }.filter { it != 8 }
    assertEquals("[1:0, 5:1, 6:0, 7:1]", result.formatString())
  }

  @Test
  fun resultAlwaysSatisfiesDepthInvariants() {
    // Try many different predicates and check the output is still a valid forest.
    val predicates: List<(Int) -> Boolean> = listOf(
      { it % 2 == 0 }, { it % 3 != 0 }, { it > 5 }, { it < 5 }, { it in setOf(1, 3, 8, 11) },
    )
    for (p in predicates) {
      assertValidDepths(example.filter(p))
    }
  }

  @Test
  fun handlesLargeHierarchyInLinearTime() {
    // One very deep chain. A quadratic approach (e.g. walking up to check
    // every ancestor) would be noticeably slow here.
    val n = 1_000_000
    val big = hierarchy(IntArray(n) { it }, IntArray(n) { it })
    val result = big.filter { it != n / 2 }
    assertEquals(n / 2, result.size)
    assertEquals(n / 2 - 1, result.nodeId(result.size - 1))
  }

  // ---- Helpers ----

  private fun hierarchy(ids: IntArray, depths: IntArray): Hierarchy = ArrayBasedHierarchy(ids, depths)

  private fun assertFiltered(source: Hierarchy, expected: String, predicate: (Int) -> Boolean) {
    assertEquals(expected, source.filter(predicate).formatString())
  }

  private fun assertValidDepths(h: Hierarchy) {
    if (h.size == 0) return
    assertEquals(0, h.depth(0), "first node must be a root")
    for (i in 1 until h.size) {
      assertTrue(h.depth(i) <= h.depth(i - 1) + 1, "depth jumped by more than one at index $i")
    }
  }
}

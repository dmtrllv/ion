# Signals

## Signal

A signal stores a mutable value and acts as a source of reactive changes.

### Semantics

- Reading a signal establishes a dependency on it.
- Writing a signal updates its value immediately.
- A write propagates a change only when the new value differs from the previous value according to the signal's equality rule.
- Change propagation updates reactive state and enqueues work for later processing.
- `update()` applies a mutation callback to the current value and propagates the change.

### Implementation

- `Signal<T>` exposes `get()`, `inspect()`, `set()`, `update()`, and `subscribe()`.
- `get()` registers the currently executing reactive computation as a dependent.
- `inspect()` reads the value without establishing a dependency.
- `set()` compares the new value with the current value and does nothing if they are equal.
- `update()` applies a mutation callback to the current value. Since the callback may mutate an object in place, the operation notifies dependents without relying on reference equality to detect the mutation.
- Writes notify dependents through the reactive graph.
- Dependencies are stored so they can be removed when no longer needed.
- Notification and processing of enqueued work are separate operations.

## Scope

A scope executes a closure, returns its result, and tracks the reactive values read during execution.

### Semantics

- A scope becomes invalidated when a signal it depends on changes or a memo it depends on produces a changed value.
- Invalidation changes the scope's state immediately, but its event notification is queued.
- A scope does not immediately rerun when invalidated.
- A scope can depend on reactive values created outside its own scope.
- When run, a scope executes its closure from the beginning, resolving values sequentially.
- Explicit calls to `run()` execute the closure only if the scope has never been initialized or is currently invalidated. Otherwise, `run()` returns the cached result.
- Each scope owns its own queue.
- Flushing a scope processes its queue, which may trigger pending memo recalculations and effect executions.
- A scope's queue is independent of other scopes' queues. The consumer determines which scopes to flush and when.

### Implementation

- A scope tracks its current dependencies, invalidation state, initialization state, cached result, execution state, slots, event handlers, and queue.
- During execution, reactive reads register dependencies against the active scope.
- After successful execution, dependencies from the previous run that were not read again are removed, and newly read dependencies become the current dependency set.
- If execution fails, dependencies from the previous successful run are retained, newly acquired dependencies are removed, and the scope remains invalidated.
- A scope cannot be run recursively while it is already running.
- If the scope is invalidated during execution, it remains invalidated after the run completes.
- The scope exposes events for relevant state transitions.
- Invalidation events are enqueued when the scope becomes invalidated and emitted when the scope's queue is flushed.
- Repeated invalidations while the scope is already invalidated are coalesced; they do not enqueue duplicate invalidation events.
- `flush()` drains the scope's queue, including additional work enqueued into that same scope while it is being flushed.
- Flushing one scope does not implicitly flush other scopes.
- Errors encountered while executing the scope closure are reported by `run()`. Errors encountered while flushing queued work are reported by `flush()`, after eligible queued work has been processed.

## Global Scope

The global scope is a special scope used to represent global reactive context and notify the runtime when effects need processing. It follows the same queue and flushing principles as other scopes.

### Semantics

- The global scope does not execute a user-defined closure and cannot be rerun.
- Its only event is `Pending`, indicating that effects need processing.
- The global scope owns its own queue; it does not own or coordinate the queues of other scopes.
- Signals, memos, and invalidated scopes do not directly emit events to the global scope.
- Multiple effect invalidations are coalesced while a pending notification is already outstanding.
- Scope invalidation alone does not request a global pending notification.
- The consumer determines when to flush the global scope and when to execute pending effects.

### Implementation

- The global scope maintains whether a `Pending` notification has already been emitted and remains outstanding.
- When an effect transitions from not pending to pending, the global scope enqueues a `Pending` notification if none is outstanding.
- Further effect invalidations do not enqueue additional notifications while one is outstanding.
- `Pending` is emitted when the global scope's queue is flushed.
- Once pending effects have been processed and the notification state is reset, a subsequent transition to pending can enqueue another notification.
- The global scope does not execute effects itself; the runtime handles effect processing in response to its `Pending` event.
- Errors encountered while flushing the global scope's queue are reported by its `flush()` operation.

## Memo

A memo computes and caches a derived value from reactive dependencies.

### Semantics

- Reading a memo establishes a dependency on its computed value.
- When an upstream dependency changes, the memo becomes stale.
- A stale memo recomputes when its value is requested or when pending reactive work is processed.
- Dependents are notified only if recomputation produces a changed value.
- A memo becoming stale does not, by itself, invalidate scopes that depend on it.
- A memo cannot automatically track changes to ordinary JavaScript variables captured by its closure.

### Implementation

- A memo stores its computation, cached value, dependencies, and stale state.
- Reactive reads during computation register dependencies against the memo.
- Changes to its dependencies mark it stale.
- When read while stale, the memo recomputes and reconciles its dependencies.
- Recalculation compares the new value with the previous value using the selected equality rule.
- If the value changed, the memo propagates a value-change notification to its dependents.
- If the value did not change, downstream dependents are not notified.
- Memo recomputation does not require a global `Pending` event unless it causes an effect to become pending.

## Effect

An effect executes a closure for reactive side effects.

### Semantics

- Reactive reads establish dependencies for the effect.
- When a dependency changes, the effect becomes pending for execution.
- Effects execute during reactive processing, not synchronously as part of a signal write.
- An effect becoming pending does not invalidate scopes.
- Pending effects are the only reason for the global scope to emit `Pending`.
- Multiple invalidations before execution are coalesced.

### Implementation

- An effect stores its computation, dependencies, and pending state.
- Reactive reads register dependencies against the active effect.
- Dependency changes mark the effect pending and request a global pending notification.
- On execution, the effect reconciles its dependencies.
- If supported, a cleanup function returned by the previous execution runs before the next execution.
- Effect execution is controlled by the consumer's runtime, not by the global scope itself.
- Errors from effect execution are reported by the operation that executes the effect, normally the runtime's reactive-processing operation.

### Consumer responsibilities

- The consumer owns the component tree, including parent-child relationships between component instances.
- The consumer decides which scopes to flush and in what order.
- The consumer determines when to rerun invalidated component scopes.
- The consumer reconciles the nodes returned by component scopes.
- The consumer decides whether existing child scopes can be retained, whether new scopes must be created, and which scopes must be disposed.
- The consumer prevents disposed scopes from being scheduled or executed again.
- The consumer handles global ordering across independently queued scopes.

### Scheduling semantics

- The signal library does not impose a global ordering across scope queues.
- Each scope's queue is processed independently through that scope's `flush()` method.
- Flushing a scope does not automatically flush its parent, children, or sibling scopes.
- The consumer can batch invalidations and determine an appropriate reconciliation order.
- Parent-child ordering is a consumer scheduling policy, not a responsibility of `GlobalScope`.
- Pending effects are scheduled through the global `Pending` notification, but their execution order remains the consumer's responsibility.
- Work generated during reconciliation can enqueue further work. The consumer determines when that work is processed.

### Reconciliation example

For a component tree such as:

```text
Root
└── Parent
    ├── Child A
    └── Child B
```

A signal update may invalidate both `Parent` and `Child A`.

1. The signal updates immediately and propagates invalidation.
2. Each affected scope updates its invalidation state and queues its own event.
3. The consumer flushes the relevant scope queues.
4. The consumer determines the scheduling and reconciliation order.
5. The parent may rerun and reconcile its children before the consumer decides whether `Child A` should still exist.
6. The consumer retains, creates, or disposes of child scopes as required.
7. Disposed scopes are removed from scheduling so that obsolete work cannot execute against them.

This separation allows different consumers to implement different scheduling and reconciliation policies without changing the signal library.

## Reactive Processing

Reactive processing propagates changes through the dependency graph while keeping staleness, pending work, and scope invalidation distinct.

### Implementation concepts

- **Stale:** A memo's cached value may no longer be valid.
- **Pending:** An effect needs execution.
- **Invalidated:** A scope's result needs reevaluation.
- **Queued event:** A scope has an event awaiting delivery through its own queue.
- **Pending event:** A global notification that pending effects need processing.

### Change propagation

1. A signal write updates its value immediately and propagates changes through its dependents.
2. Dependent memos become stale.
3. Scopes that depend directly on the changed signal become invalidated immediately. Their `Invalidated` events are enqueued in their respective scope queues.
4. When a stale memo is read or recalculated during reactive processing, it recomputes and compares its new result with its previous result.
5. If the memo's result changed, its dependents are notified. Dependent scopes become invalidated, and dependent memos become stale.
6. If an effect becomes pending, the global scope enqueues a coalesced `Pending` event.
7. Each scope's queued events are delivered when that scope is flushed. Flushing a scope drains its own queue, including work added to that queue during flushing.
8. The consumer processes pending effects in response to the global `Pending` notification. Reading a stale memo during effect execution recomputes it as needed.
9. If reactive processing causes additional work to be enqueued, the consumer determines when the affected scopes are flushed and when pending effects are executed.
10. The consumer schedules invalidated component scopes, reruns them when appropriate, and reconciles their returned nodes.

Scope invalidation does not automatically execute the scope. The consumer of the signal library decides when to flush affected scopes, rerun invalidated scopes, and handle their returned values.

Each scope owns its own queue. The global scope does not coordinate these queues; it follows the same queue and flush principles while providing the global `Pending` notification.

### Error handling

- Event dispatch should invoke all eligible handlers even if an individual handler throws.
- Handler errors must not be silently discarded.
- Errors encountered during a flush are collected while eligible queued work continues to be processed, then reported by the relevant `flush()` operation.
- Errors thrown by a scope closure are reported by `run()`.
- Errors from deferred work are reported by the operation that executes that work, not retroactively by the signal write that originally enqueued it.
- The exact error aggregation strategy, including whether multiple failures are reported through `AggregateError`, remains to be finalized.

### Remaining design decisions

- Equality rules for signals and memos.
- The precise ordering of memo recomputation and effect execution.
- Whether asynchronous effects are supported and how their completion is handled.
- Reentrancy and scheduling rules for updates made during reactive processing.
- The exact error aggregation and reporting mechanism.
- Whether a flush has a bounded processing policy or always drains newly enqueued work until its queue is empty.
- The exact lifecycle and disposal semantics for scopes.
- The consumer's scheduling policy for parent-child reconciliation and newly created scopes.
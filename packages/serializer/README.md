# Making the Ion Test Application Work

## Goal

Make the `@ion/test-app` example work with the current `@ion/signal` implementation.

The example should demonstrate:

- Signals storing and propagating changes.
- Scopes tracking dependencies and rerunning when invalidated.
- Effects executing after creation and after their dependencies change.
- Effect cleanup running before the next execution and when an effect is disposed.
- Queued events being processed without recursive flushing.
- Errors being reported with enough information to identify the failed reactive object.

Effect callbacks are synchronous. The effect may schedule external asynchronous work, such as a timer, and return a synchronous cleanup callback, but the signal library does not support asynchronous effect execution.
a
## 1. Fix effect scheduling

**File:** `signal/src/effect.ts`

### Current problem

The `Effect` constructor captures the active scope but calls `this.#scope.invalidate()`.

This invalidates the owning scope rather than notifying the consumer that an effect is pending. It conflates two different states:

- `Invalidated`: a scope must reevaluate its closure.
- `Pending`: an effect must execute.

An effect becoming pending should not, by itself, invalidate its owner scope.

### Required changes

1. Keep the owning scope captured at effect creation.
2. Introduce a distinct internal operation for notifying the owning scope that effects are pending, such as `notifyPending()`.
3. Have both `Scope` and `GlobalScope` support the appropriate pending-notification operation, so `Effect` does not need to import or reference `GlobalScope` directly.
4. Use the captured owner scope to notify pending work when the effect is created and whenever it transitions from not pending to pending.
5. Coalesce repeated notifications while a pending notification is already queued.
6. Preserve the existing behavior where a failed effect does not automatically become pending again.

Do not implement pending notification by calling `Scope.invalidate()`. Scope invalidation and effect scheduling must remain separate.

## 2. Make pending effects discoverable

**Files:** `signal/src/scope.ts`, `signal/src/slot.ts`, `signal/src/index.ts`

### Current problem

The scope stores signals, memos, and effects in its slots, but it does not expose a way for the consumer to find pending effects.

`Effect.execute()` exists, but nothing in the current example invokes it.

The `GlobalScope` also only emits a `Pending` event. It does not execute effects or provide an effect-processing loop.

### Required changes

1. Add an API for the consumer to retrieve pending effects belonging to a scope.
2. Ensure that only effects whose `isPending` state is true are selected.
3. Expose the necessary API through the package's public exports if the consumer needs it outside the signal package.
4. Keep effect execution under consumer/runtime control rather than making `flush()` implicitly execute effects.

The consumer should be able to respond to a pending notification, retrieve pending effects, execute them, and handle their returned results.

## 3. Deliver pending events through the owning scope

**Files:** `signal/src/scope.ts`, `signal/src/global-scope.ts`

### Current problem

`ScopeEvent.Pending` is declared, but the regular `Scope` currently only enqueues `Invalidated` events. Consequently, the test application's `Pending` event handler cannot receive a pending event from its `app` scope.

The global scope can queue `Pending` events, but the test application subscribes to `app.onEvent()`, not to the global scope.

### Required changes

1. Allow a regular scope to enqueue and emit a `Pending` event without marking itself invalidated.
2. Preserve the separate `Invalidated` event for scope dependency changes.
3. Ensure a scope can notify its consumer when an effect created in that scope becomes pending.
4. Keep each scope's queue independent.
5. Continue coalescing duplicate pending notifications while one is already queued.

The active scope captured when an effect is created should be the context used for this notification. The effect implementation should not directly depend on `GlobalScope`.

## 4. Restore the owning scope during effect execution

**Files:** `signal/src/scope.ts`, `signal/src/effect.ts`

### Current problem

`Effect.execute()` uses `withObserver()` to establish dependency tracking, but it does not establish the effect's owning scope as the active scope.

The active scope is currently changed only during `Scope.run()`.

Consequently, if an effect creates or retrieves a signal or memo during execution, `getActiveScope()` may resolve to a different scope than the one that owns the effect.

### Required changes

1. Add an internal helper that temporarily establishes a specified active scope while executing a synchronous closure.
2. Restore the previous active scope in a `finally` block.
3. Execute the effect closure with both the owning scope and the effect observer established.
4. Restore both contexts even when the closure throws.
5. Keep this mechanism synchronous; asynchronous context propagation is not required.

This should be implemented as a reusable scope-context mechanism rather than duplicating active-scope manipulation inside `Effect`.

## 5. Correct effect execution and cleanup

**File:** `signal/src/effect.ts`

The current implementation already contains much of the required effect lifecycle, but the following invariants must be maintained.

### Execution

- A newly created effect begins pending.
- Executing a non-pending effect is a no-op.
- Executing a pending effect clears its pending state before running the closure.
- Dependencies are collected during execution.
- Previous dependencies that are no longer read are removed only after successful execution.
- Dependencies acquired during a failed execution are removed if they were not part of the previous successful dependency set.
- A failure returns an error result containing `source: this`.
- A failed execution does not automatically retry.
- If a dependency invalidates the effect during execution, a successful execution must preserve that new pending state and notify the owning scope.

### Cleanup

- The cleanup callback from the previous successful execution runs before the next execution.
- A cleanup callback returned by a successful execution is retained for the next execution or disposal.
- Disposal removes the effect from its dependencies and runs its remaining cleanup at most once.
- Cleanup failures are returned as errors identifying the effect.
- Disposed effects cannot execute or become pending again.

### Synchronous contract

Keep `EffectClosure` and `EffectCleanupCallback` synchronous.

A callback that returns a promise must not be silently treated as a successful effect execution. Add runtime detection for thenables if necessary, since TypeScript's `void` callback return type does not reliably prevent an asynchronous function from being passed in every callback context.

## 6. Make scope result handling consistent

**File:** `signal/src/scope.ts`

### Current problem

`Scope.run()` is declared to return `Result<T>`, and the test application destructures `{ data, error }` from its result. However, its catch block rethrows the error instead of returning an error result.

This makes the declared return contract inconsistent with the implementation.

### Required changes

Choose one consistent contract. The preferred contract is to return the declared discriminated union:

- Success: `{ data: value }`
- Failure: `{ error }`

On failure, retain the previous successful dependency set, remove newly acquired dependencies, and leave the scope invalidated so the consumer can decide what happens next.

The test application should be able to handle the returned error without needing a separate exception handler for ordinary scope execution failures.

This is separate from errors returned by effect execution. The consumer must handle both result types.

## 7. Fix the test application's processing loop

**File:** `test/src/index.ts`

### Current problem

The example registers an event handler, but queued events are only delivered when `app.flush()` is called.

The current example does not establish a reliable processing cycle that flushes the scope after the initial run, after `addTodo()`, and after timer-driven updates.

Furthermore, the `Pending` handler calls `app.flush()` from inside `app.flush()`'s own event dispatch. That would cause a reentrant-flush error.

### Required changes

1. Run the scope once to initialize the application.
2. Flush the scope to deliver its queued events.
3. When an `Invalidated` event is handled, rerun the scope and handle the returned result.
4. When a `Pending` event is handled, retrieve and execute pending effects. Do not recursively call `app.flush()` from that handler.
5. Flush again after explicit updates such as `addTodo()`.
6. Flush after timer callbacks update the signal, so their queued invalidation and pending events are processed.
7. Report errors from scope execution and effect execution rather than silently discarding them.

For this initial example, explicit flushing is sufficient. A general-purpose scheduler that automatically arranges processing whenever a queue receives new work can be added later.

The timer callback can continue to use `todos.update()` and then request another processing cycle. The effect itself remains synchronous: it starts a timer and returns a cleanup callback.

## 8. Define the processing order

The example should follow this cycle:

1. A signal is updated.
2. The signal immediately invalidates dependent scopes, memos, and effects.
3. Each affected scope updates its state and enqueues the appropriate event.
4. The consumer flushes the relevant scope queue.
5. The consumer reruns invalidated scopes.
6. The consumer executes pending effects.
7. Effects that schedule additional work or cause further invalidation enqueue more work.
8. The consumer continues processing queued work until the intended processing cycle is complete.

The signal package should not impose a global ordering across independent scopes. The consumer remains responsible for scheduling and reconciliation.

A `Pending` event is a notification that effects need processing; it is not itself effect execution.

## 9. Add tests before expanding the example

Add focused tests for the following cases.

### Scope

- A scope runs on first invocation.
- A valid scope returns its cached result.
- A signal change invalidates the scope.
- A queued invalidation event is delivered only when the scope is flushed.
- A failed scope execution returns an error result and retains its previous successful dependencies.
- Repeated invalidations are coalesced.

### Effect

- An effect is pending after creation.
- An effect executes only when explicitly processed.
- Reading a signal establishes an effect dependency.
- Updating a dependency makes the effect pending and notifies its owner scope.
- Multiple invalidations while pending are coalesced.
- A successful rerun replaces the dependency set.
- A failed execution returns an error identifying the effect and does not schedule a retry.
- Cleanup runs before the next execution and during disposal.
- An effect invalidated during execution remains pending after a successful run.
- Disposed effects cannot be executed or rescheduled.

### Integration

- The initial effect runs after the first processing cycle.
- Adding a todo triggers the expected scope and effect processing.
- The timer removes a todo and triggers another processing cycle.
- Cleanup cancels the previous timer before a replacement timer is created.
- Emptying the todo list prevents another timer from being scheduled.
- Errors from scopes and effects are handled without corrupting the processing loop.
- Calling `flush()` recursively is rejected and is not part of the normal consumer workflow.

## 10. Implementation order

Implement these changes in this order:

1. Separate pending notification from scope invalidation.
2. Add pending-effect discovery to scopes.
3. Establish active-scope context during effect execution.
4. Finalize synchronous effect execution, cleanup, and error handling.
5. Make `Scope.run()` honor its declared result contract.
6. Update the test application's processing loop.
7. Add the focused unit and integration tests.
8. Run the compiler and build the test application to verify the complete flow.

## Definition of done

The test application is working when its initial run schedules and executes the effect, signal updates invalidate the appropriate reactive objects, the consumer processes queued events without reentrant flushing, and each timer-driven update causes the effect to rerun with correct cleanup.

The example should demonstrate that signal mutation, scope invalidation, effect scheduling, effect execution, and queue flushing are distinct operations coordinated by the consumer.

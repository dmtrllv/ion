# Signals

## Signal

A signal stores a mutable value and acts as a source of reactive changes.

### Semantics
- Reading a signal establishes a dependency on it.
- Writing a signal updates its value.
- A write only propagates a change when the new value differs from the previous value.
- Change propagation and scope invalidation are deferred.

### Implementation
- `Signal<T>` exposes `get()`, `inspect()`, `set()`, `update()`, and `subscribe()`.
- Reactive reads register the currently executing reactive computation as a dependent.
- Writes notify dependents and propagate staleness through the reactive graph.
- `update()` applies a mutation callback to the current value.
- Dependencies are stored so that they can be removed when no longer needed.

## Scope

A scope executes a closure, returns its result, and tracks the reactive values read during execution.

### Semantics
- A scope becomes invalidated when a signal it depends on changes or a memo it depends on produces a changed value.
- Invalidation is deferred.
- Invalidating a scope does not immediately rerun its closure.
- A scope can depend on reactive values created outside its own scope.
- When rerun, a scope executes its closure from the beginning, resolving values sequentially.
- Changes to ordinary JavaScript variables are not tracked. Developers must use signals or other reactive values when changes need to trigger invalidation.

### Implementation
- A scope tracks its current dependencies and its invalidation state.
- During execution, reactive reads register dependencies against the active scope.
- After execution, dependencies from the previous run that were not read again are removed.
- Newly read dependencies are registered.
- The scope exposes events for relevant state transitions.
- `flush()` does not implicitly rerun the scope or update all signals and memos.
- `run()` executes the scope closure. Whether it executes only when invalidated or also supports explicit execution remains to be defined.
- Scope invalidation and pending reactive work are separate concepts.

## Global Scope

The global scope tracks pending effect updates and notifies the runtime that effects need processing.

### Semantics
- The global scope does not execute a user-defined closure and cannot be rerun.
- Its only event is `Pending`, indicating that effects need processing.
- Signals, memos, and invalidated scopes do not directly emit events to the global scope.
- Multiple effect invalidations are coalesced while a pending notification is already outstanding.
- Scope invalidation alone does not request a global pending notification.

### Implementation
- The global scope maintains whether a `Pending` notification has already been emitted and remains outstanding.
- When an effect transitions from not pending to pending, the global scope emits `Pending` if no notification is outstanding.
- Further effect invalidations do not emit additional notifications while one is outstanding.
- Once pending effects have been processed and the notification state is reset, a subsequent transition to pending can emit another event.
- The global scope does not execute effects itself; the runtime handles processing in response to its event.

## Memo

A memo computes and caches a derived value from reactive dependencies.

### Semantics
- Reading a memo establishes a dependency on its computed value.
- When an upstream dependency changes, the memo becomes stale.
- A stale memo recomputes when its value is requested.
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

### Implementation
- An effect stores its computation, dependencies, and pending state.
- Reactive reads register dependencies against the active effect.
- Dependency changes mark the effect pending and request global pending notification.
- Multiple invalidations may be coalesced before execution.
- On execution, the effect reconciles its dependencies.
- If supported, a cleanup function returned by the previous execution runs before the next execution.

## Reactive Processing

Reactive processing propagates changes through the dependency graph while keeping staleness, pending work, and scope invalidation distinct.

### Implementation concepts
- **Stale:** A memo's cached value may no longer be valid.
- **Pending:** An effect needs execution.
- **Invalidated:** A scope's result needs reevaluation.
- **Pending event:** A global notification that pending effects need processing.

### Change propagation
1. A signal write updates its value and propagates changes to its dependents.
2. Dependent memos become stale.
3. Scopes that directly depend on the changed signal become invalidated, with invalidation deferred.
4. When a stale memo is read, it recomputes and compares its new result with its previous result.
5. If the memo's result changed, its dependents are notified. Dependent scopes become invalidated, and dependent memos become stale.
6. If an effect becomes pending, the global scope emits a coalesced `Pending` event.
7. The runtime processes pending effects. Reading a stale memo during effect execution recomputes it as needed.

Scope invalidation does not automatically execute the scope. The consumer of the signal library, such as a future JSX runtime, decides when to rerun invalidated scopes and how to handle their returned values.

The precise execution order for pending effects, equality rules, error handling, and reentrant updates remains to be defined.
# Comptime Implementation TODO

## 1. Symbol and Module Resolution
- [ ] Resolve imported symbols to their original declarations.
- [ ] Link imports to their corresponding `Module` instances.
- [ ] Handle re-exports and aliased imports.
- [ ] Identify comptime declarations through resolved symbols.

## 2. Dependency Discovery
- [ ] Define data structures for comptime declarations, call sites, and dependencies.
- [ ] Discover comptime calls in source ASTs.
- [ ] Recursively discover comptime dependencies.
- [ ] Detect circular dependencies.

## 3. Comptime Evaluation
- [ ] Identify which transformed modules are required.
- [ ] Load compiled comptime JavaScript modules.
- [ ] Resolve comptime declarations to their JavaScript exports.
- [ ] Validate comptime call arguments.
- [ ] Evaluate comptime calls and cache results.

## 4. Source Rewriting
- [ ] Associate evaluation results with their source expressions.
- [ ] Convert generated comptime syntax into TypeScript AST nodes.
- [ ] Replace comptime calls with generated expressions.
- [ ] Emit the resulting runtime JavaScript.

## 5. Testing
- [ ] Test `signal(123)` end to end.
- [ ] Test multiple calls and persistent comptime state.
- [ ] Test nested comptime dependencies.
- [ ] Test imports, aliases, and re-exports.
- [ ] Test invalid arguments and circular dependencies.

## Working Order

Complete one section at a time. Discuss the design before implementing each step, then test it before moving on.
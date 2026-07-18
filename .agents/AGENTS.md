# SolidJS Reactivity Rules for Truck-Trip-Tracker

To ensure code correctness and avoid stale snapshot bugs, adhere to the following rules:

1. **Never copy reactive state into plain constants/variables**:
   - Bad: `const orgId = currentUserRights()?.organizationId;`
   - Good (Accessor): `const orgId = () => currentUserRights()?.organizationId || '';`
   - Good (Memo): `const orgId = createMemo(() => currentUserRights()?.organizationId || '');`

2. **Pass accessors instead of values to props when child components need to react dynamically**:
   - Pass the signal/memo accessor itself: `<Child orgId={orgId} />`
   - Inside the child component, access it as `props.orgId()` or track it reactively.

3. **Do not destructure props**:
   - Bad: `const { orgId } = props;`
   - Good: `props.orgId` or `const orgId = () => props.orgId;`

4. **Use `createMemo` for derived state**:
   - Wrap derived calculations in `createMemo` to cache results and ensure reactivity propagation.

5. **Use `createEffect` only for side effects**:
   - Use `createEffect` for logging, WebSocket subscriptions, synchronization, or DOM updates. Do not use it for computing values. Use `createMemo` for computations.

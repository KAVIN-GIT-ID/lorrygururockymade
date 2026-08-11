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

---

## 📱 Mobile UI/UX Design System Rules (Clean Light-Theme Utility)
1. **Visual Style**:
   - **Theme**: Clean Off-White Background (`#F8FAFC`), Pure White Cards (`#FFFFFF`) with `1px` Slate Borders (`#E2E8F0`), Deep Charcoal Text (`#0F172A`).
   - **Primary Action Accent**: Vibrant Solid Emerald Green (`#059669`).
   - **No Glossy Dark Glassmorphism**: Avoid dark transparency or heavy glowing neon effects; prioritize outdoor sunlight readability.

2. **Architecture Separation**:
   - **Desktop & Mobile Isolation**: Keep `DesktopViewport.tsx` and `MobileViewport.tsx` strictly separated. Modifying mobile screens MUST NEVER alter desktop views.
   - **Shared Context Layer**: Both viewports share `TripContext`, `TruckContext`, `DriverContext`, `ExpenseContext`, and `AppwriteCloudSync`.

3. **Form & Navigation Patterns**:
   - Use **Slide-Up Bottom Sheet Modals** for data entry forms (`Add Truck`, `Add Expense`, `Add Driver`).
   - Use **3-Phase Trip Lifecycle**: Step 1 (30-sec Quick Dispatch) ➔ Step 2 (En-Route Live Timeline) ➔ Step 3 (Final Settlement & Net Profit Close).
   - Expenses like Loading, Unloading, RMC, Mamul, and Brokerage belong directly to individual **Sub-Trips**.

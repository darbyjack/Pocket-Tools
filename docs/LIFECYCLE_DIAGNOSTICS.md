# Lifecycle and Namespace Diagnostics

Pocket Tools includes a host-owned diagnostics screen for proving the installed-script persistence boundary on Android. Open **Host diagnostics** from the mini-app library.

The diagnostics use temporary SDK v1 scripts and the same QuickJS, operation validation, installed-source, and Expo SQLite paths as ordinary installed mini apps. They do not add a public SDK capability or another reference mini app.

## Immediate host suite

**Run isolation and recovery suite** performs the following in one repeatable run:

1. Creates and installs two temporary scripts with different manifest IDs.
2. Gives both scripts the same setting name, collection name, field name, action names, and timer ID.
3. Stores different setting values in the two namespaces.
4. Invokes each script through QuickJS to insert a record and start a durable timer.
5. Reloads both snapshots and proves each script sees only its own setting, record, and timer.
6. Runs an action that intentionally throws before returning operations.
7. Proves the failed invocation persisted no setting, record, or timer changes.
8. Runs a valid action immediately afterward and proves the fresh QuickJS invocation succeeds.
9. Removes one installed script while retaining its data, reinstalls the same manifest ID, and proves the state returns.
10. Removes the script with data and proves its complete namespace is empty.
11. Removes all temporary diagnostic installations and data.

The screen reports separate pass/fail results for namespace isolation, failed-invocation recovery, and deletion semantics.

## Force-stop timer recovery

Durable timer recovery is intentionally a two-launch procedure because an in-process test cannot prove process death.

1. Press **Prepare force-stop test**.
2. Pocket Tools installs a temporary diagnostic script, starts its host-managed timer through the ordinary action path, and saves a checkpoint containing the installed app ID and persisted start timestamp.
3. Force-stop the application:

   ```bash
   adb shell am force-stop com.darbyjack.pockettools
   ```

4. Confirm the host process is absent:

   ```bash
   adb shell pidof com.darbyjack.pockettools
   ```

   The command must print no PID. This is the manual evidence that neither React Native nor QuickJS remained alive while the timer was active.

5. Wait at least one second and reopen Pocket Tools.
6. Open **Host diagnostics** and press **Resume after relaunch**.
7. Pocket Tools verifies:
   - The temporary installation survived.
   - The timer has the exact persisted start timestamp.
   - Reconstructed elapsed time includes the period while the process was absent.
   - Reconstructed elapsed time agrees with the current host clock.
   - The recovered timer can be stopped through the ordinary action path.
8. The temporary installation, namespace, and checkpoint are removed.

The timer is never backed by a resident QuickJS context or background JavaScript. Recovery is derived from the UTC start timestamp stored by the host.

## Crash and abandoned-state cleanup

Temporary diagnostic manifest IDs use the reserved `lifecycle-diagnostic-` prefix and are hidden from the normal library. User-installed scripts cannot use this prefix.

At startup, Pocket Tools removes abandoned diagnostic installations and data while preserving the single installation referenced by an active force-stop checkpoint. The Reset action also removes the pending checkpoint and its temporary state.

## Fast repository checks

The normal repository test command includes:

- Durable elapsed-time reconstruction tests
- Preview and diagnostic namespace-prefix tests
- Installer rejection of reserved diagnostic IDs
- QuickJS inspection of the internal lifecycle fixture against frozen SDK v1

Run:

```bash
pnpm check
```

These fast tests do not replace the Android force-stop procedure.

## Android build and device run

```bash
corepack enable
pnpm install
pnpm check
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest
```

Then open the application and complete both diagnostics from the library.

## Evidence status

Code and repeatable diagnostic procedures are included in this phase. A passing Android build, immediate suite result, `pidof` observation, and resumed timer result must be recorded after they are actually run. Do not mark issue #7 complete based only on static review.

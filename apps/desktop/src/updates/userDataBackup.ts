import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";

import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";

/** Dated copies kept under <T3 home>/pre-update-backups; older ones are removed. */
const KEPT_INSTALL_BACKUPS = 3;

export class UserDataBackupError extends Schema.TaggedError<UserDataBackupError>()(
  "UserDataBackupError",
  {
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return "Could not copy your data before installing, so the install was cancelled.";
  }
}

export interface BackupUserDataInput {
  readonly baseDir: string;
  readonly fromVersion: string;
  readonly targetVersion: string;
  readonly now: DateTime.Utc;
}

/**
 * Folders under userdata the copy leaves out: downloaded speech models (26 GB on the Mac), fetched
 * again if lost. With them, the copy did not fit on the disk and cancelled the install.
 */
const SKIPPED_FOLDERS: ReadonlyArray<readonly string[]> = [
  ["speech", "models"],
  ["dictation", "models"],
];

/** Copies a folder entry by entry, leaving out the skipped folders below it. */
const copyWithoutSkipped: (
  source: string,
  target: string,
  skipped: ReadonlyArray<readonly string[]>,
) => Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =
  Effect.fn("desktop.updates.copyWithoutSkipped")(function* (source, target, skipped) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fileSystem.makeDirectory(target, { recursive: true });
    for (const name of yield* fileSystem.readDirectory(source)) {
      const below = skipped.filter((parts) => parts[0] === name);
      if (below.some((parts) => parts.length === 1)) continue;
      const from = path.join(source, name);
      const to = path.join(target, name);
      // A link is copied as a link, as the whole-folder copy did; only a real folder is entered.
      const isLink = Option.isSome(yield* fileSystem.readLink(from).pipe(Effect.option));
      if (below.length > 0 && !isLink && (yield* fileSystem.stat(from)).type === "Directory") {
        yield* copyWithoutSkipped(
          from,
          to,
          below.map((parts) => parts.slice(1)),
        );
      } else {
        yield* fileSystem.copy(from, to, { preserveTimestamps: true });
      }
    }
  });

// Versions become part of a folder name, so anything but plain name characters becomes "-".
const folderPart = (version: string) => version.replace(/[^A-Za-z0-9._-]/g, "-");

/**
 * Copies <baseDir>/userdata, without the speech models, into a new folder under <baseDir>/pre-update-backups, named for the
 * time and the two versions, and returns that folder. Returns none when there is no data yet.
 * The caller stops the backends first, so the database is closed and the copy is consistent.
 */
export const backupUserData = Effect.fn("desktop.updates.backupUserData")(
  function* (input: BackupUserDataInput) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const source = path.join(input.baseDir, "userdata");
    if (!(yield* fileSystem.exists(source))) return Option.none<string>();

    const backupsDir = path.join(input.baseDir, "pre-update-backups");
    const stamp = DateTime.formatIso(input.now).replace(/[:.]/g, "-");
    const folder = path.join(
      backupsDir,
      `${stamp}_${folderPart(input.fromVersion)}_to_${folderPart(input.targetVersion)}`,
    );
    yield* fileSystem.makeDirectory(folder, { recursive: true });
    yield* copyWithoutSkipped(source, path.join(folder, "userdata"), SKIPPED_FOLDERS);

    // Names start with the time, so sorting them puts the oldest first. A failed cleanup keeps the new copy.
    const names = (yield* fileSystem.readDirectory(backupsDir)).toSorted();
    const stale = names.slice(0, Math.max(0, names.length - KEPT_INSTALL_BACKUPS));
    yield* Effect.forEach(
      stale,
      (name) => fileSystem.remove(path.join(backupsDir, name), { recursive: true, force: true }),
      { discard: true },
    ).pipe(Effect.ignore);

    return Option.some(folder);
  },
  Effect.mapError((cause) => new UserDataBackupError({ cause })),
);

export class UserDataBackup extends Context.Service<
  UserDataBackup,
  {
    /** Copies the data before an install to `targetVersion`. A failed copy cancels that install. */
    readonly backupBeforeInstall: (
      targetVersion: string,
    ) => Effect.Effect<Option.Option<string>, UserDataBackupError>;
  }
>()("@t3tools/desktop/updates/userDataBackup") {}

export const layer = Layer.effect(
  UserDataBackup,
  Effect.gen(function* () {
    const environment = yield* DesktopEnvironment.DesktopEnvironment;
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return UserDataBackup.of({
      backupBeforeInstall: Effect.fn("desktop.updates.backupBeforeInstall")(
        function* (targetVersion) {
          const now = yield* DateTime.now;
          return yield* backupUserData({
            baseDir: environment.baseDir,
            fromVersion: environment.appVersion,
            targetVersion,
            now,
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          );
        },
      ),
    });
  }),
);

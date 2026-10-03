# On Debian without libsqlite3-dev the integration suite runs zero tests, and dotnet test still prints "failed: 0"

Measured on Debian 13 (2026-10-03), running the backend gate from CLAUDE.md:

```text
Test run summary: Failed!
  total: 1629
  failed: 0
  succeeded: 1629
```

That reads as green with an odd headline. It is not. The 1629 are the **unit** tests only.
`IntegrationTests.dll` never ran a single test: its process died in the module initializer
with exit code 134, and the summary folds that into `error: 1` (shown only in the full
output) and `Zero tests ran`, neither of which survives a `grep failed:`.

## The cause is a missing symlink, not SpatiaLite

[`SqliteProvider.cs`](../../backend/Tests/IntegrationTests/SqliteProvider.cs) binds the
**system** SQLite on Linux (`SQLite3Provider_sqlite3`, see [[spatialite-per-os]]). That
provider asks the loader for `sqlite3`, which on Linux means the **unversioned**
`libsqlite3.so`:

```text
System.DllNotFoundException: Unable to load shared library 'sqlite3' or one of its dependencies.
  .../libsqlite3.so: cannot open shared object file: No such file or directory
   at IntegrationTests.SqliteProvider.Init()
```

Debian's runtime package `libsqlite3-0` ships only `libsqlite3.so.0`. The unversioned name
comes from **`libsqlite3-dev`**. CI never sees this, because `ci.yml` installs
`libspatialite-dev`, which pulls in `libsqlite3-dev`. A desktop that installed only
`libsqlite3-mod-spatialite`, as [[spatialite-per-os]]'s table suggests, has the extension
and still cannot load SQLite at all.

So there are two distinct failures, in this order:

| missing | symptom | tests that run |
| --- | --- | --- |
| `libsqlite3.so` (`libsqlite3-dev`) | `DllNotFoundException: 'sqlite3'`, exit 134, `Zero tests ran` | none |
| `mod_spatialite.so` (`libsqlite3-mod-spatialite`) | every test that builds the schema fails on extension load | 7 of 501 pass |

## Fix, and a workaround that needs no root

The fix is `apt install libsqlite3-dev libsqlite3-mod-spatialite`.

Without root, both can be supplied for one run from a scratch directory. Measured: 501/501
green this way:

```sh
S=<scratch dir>
mkdir -p $S/shim && ln -sf /lib/x86_64-linux-gnu/libsqlite3.so.0 $S/shim/libsqlite3.so
cd $S && apt-get download libsqlite3-mod-spatialite libgeos-c1t64 libgeos3.14.1 libproj25 librttopo1 libfreexl1
for d in *.deb; do dpkg-deb -x "$d" root; done
cd backend && LD_LIBRARY_PATH=$S/shim:$S/root/usr/lib/x86_64-linux-gnu \
  ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build
```

The package list is whatever `apt-cache depends --recurse libsqlite3-mod-spatialite` names
that `dpkg -s` does not find installed; `proj-data` was not needed.

## How to read the summary

Look for `Zero tests ran` or `Exit code: 134` in the full output, or check that `total:` is
the sum of both projects (1629 unit + 501 integration = 2130 at the time of writing, measured
after installing both packages). A `total:` equal to the unit count alone means the
integration suite did not start.

Related: [[spatialite-per-os]], [[dotnet-test-connection-string]].

<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# ValidateOnBuild does not run constructors, so a registry that must reject bad input has to be built eagerly in AddStigVidd

`backend/StigviddAPI/Program.cs` sets `ValidateOnBuild = true` and `ValidateScopes = true`
(around lines 33-36). It is natural to read that as "a broken registration fails at host build",
and to put a duplicate-name check in the constructor of `DomainEventRegistry` and register the
class with `AddSingleton<DomainEventRegistry>()`.

That check would never run at build. `ValidateOnBuild` walks the **descriptors** and confirms each
service's dependencies are registered and correctly scoped. It does not instantiate anything. A
singleton registered by type is constructed on first resolve, which for the registry is the first
event the dispatcher processes, possibly minutes after a deploy, in production only.

So the registry is built inside `AddStigVidd` and registered as an instance:

```csharp
services.AddSingleton(DomainEventRegistry.Scan(coreAssembly));
```

`Scan` throws `InvalidOperationException` on a duplicate event name or an `IDomainEvent` without
`[DomainEventName]`. That exception happens during service registration, so the host fails to
start in production and in every `WebApplicationFactory` boot. The integration suite proves it
with `TheHostBuilds_WithTheRealRegistryAndNoDuplicateEventNames`.

The same trap applies to anything else that validates in a constructor and is registered by type.
`Scan` delegates to `FromTypes(IEnumerable<Type>)` so that tests can hand it exactly the types they
want. `Assembly.GetTypes()` returns nested private types too, so scanning the test assembly would
pick up the deliberately broken fixtures in `DomainEventRegistryTests` and throw.

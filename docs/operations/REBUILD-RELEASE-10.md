# Release 10: safety case territory access

Safety case lists and updates now require both safety-management permission and access to the case territory. Scoped managers cannot view or change another territory's case. Records with no territory are visible only to globally scoped safety managers for review; their scope is not guessed. Updates return the same not-found response for missing and inaccessible cases.

Lists follow all KV pages before returning scoped results. Malformed update bodies fail before writes. Existing valid case status/history updates remain available, and ordinary engineers still cannot browse the restricted safety queue. Safety reporting itself is unchanged.

Validation covers scoped/global list access across pages, cross-territory and legacy-record update denial without writes, permitted updates and malformed/unprivileged requests. Tests use isolated synthetic records only; no production cases were inspected or changed.

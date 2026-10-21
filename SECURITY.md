# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.3.x | Yes |
| < 1.3 | Best effort |

The plugin targets DeepSeek Harness 0.2.x. Please include the DSH build/version
and the plugin version in reports.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private vulnerability reporting:
<https://github.com/Fantety/dsh-pixel-studio/security/advisories/new>

If that is unavailable, open a minimal public issue asking for a private
contact channel; do not include exploit details or secrets.

Include:

- affected plugin version and DSH version;
- platform and Node version;
- reproduction steps or a proof of concept;
- security impact and any known mitigation.

## Scope

dsh-pixel-studio is a local plugin. It:

- reads the Session working directory and writes generated assets under
  `outputDir`;
- accepts structured grids, palettes, frame timings, shader scripts and output
  paths from the model;
- parses shader scripts and runs them in a bounded tree-walking interpreter
  with no host globals, modules, filesystem or network access;
- embeds palette-indexed frame data in tool presentation metadata;
- does not make network requests.

Relevant classes of issues include path traversal or unexpected file writes,
unbounded allocation, interpreter escapes or resource-budget bypasses,
malformed GIF/PNG/OYPX output, client-side script injection through filenames or
palette labels, and denial of service in the inline canvas decoder.

Path handling, shader budgets and generated file limits are enforced in the
host half. The client half decodes only generated metadata and renders it with
Canvas APIs.

## Disclosure

We aim to acknowledge reports within 5 business days and coordinate a fix and
disclosure date with the reporter. Please allow reasonable time before public
disclosure.

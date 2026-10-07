# Design decisions

## The one word

**Technical.** An instrument panel, not a marketing page. Dense where it should be,
quiet everywhere else, and it never celebrates.

## Type

System sans for the interface, monospace for identifiers — repository names, slugs,
token placeholders. Anything that is a literal string is set in mono so it reads as
a value rather than prose. The 1.25 scale from the template, unchanged; numbers use
`tabular-nums` wherever they sit in a column or change on refresh.

## Colour

Tokens in `src/styles/tokens.css`. The accent moves off the template's green to a
slate blue — `#2c4570` in light, `#8fb3e8` in dark — because the console is
instrumentation and should not read as a product.

Score pills are the only place colour carries meaning: green at 8 and above, muted
in the middle, red below 6. That is deliberate — an honest ledger with fives in it
should look like it has fives in it.

Every text and surface pair is asserted at 4.5:1 in both themes by
`src/styles/tokens.test.ts`, so a palette change cannot silently ship unreadable text.

## Space, shape, motion

Radius 6px, 10px for cards. Borders carry the structure; shadows are used only on
raised cards and are tinted, never pure black. Motion is limited to 120ms state
changes, the progress bar's width, and one pulsing dot for a run in progress — the
only animation on the page, because it is the only thing that is genuinely live.

## The signature detail

**The page never flashes.** A refresh keeps everything mounted and only changes the
button label. Confirmations survive the reload that follows them. Skeletons appear
on the very first load and never again. Most dashboards blink their whole layout
every poll; this one is quiet enough to leave open on a second screen.

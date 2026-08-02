# Accessibility

Accessibility is a product requirement, not a later enhancement. VIPOAP is designed for people who may have reduced vision, hearing, dexterity, confidence or familiarity with technology.

## Minimum standards

- Target WCAG 2.2 AA for public and authenticated experiences.
- All functions must be usable by keyboard.
- Controls must have clear visible focus states.
- Form fields require programmatic labels and useful instructions.
- Images need meaningful alternative text when they convey information.
- Decorative images should use empty alternative text.
- Colour must never be the only way information is communicated.
- Text and interactive controls must meet contrast requirements.
- Touch targets should be comfortably large and well spaced.
- Pages must remain usable at 200% zoom.
- Motion must respect reduced-motion preferences.

## Language and comprehension

- Use short sentences and familiar words.
- Explain technical terms when they cannot be avoided.
- Break instructions into small numbered steps.
- Avoid unexplained icons.
- Do not rely on memory across several screens; show relevant context again.
- Give users time and do not introduce avoidable session pressure.

## Forms and errors

Errors must explain:

1. what needs attention;
2. where the problem is; and
3. how to correct it.

Do not clear completed fields after an error. Never use blame-oriented wording.

Preferred:

> That email address does not look quite right. Please check it and try again.

Avoid:

> Invalid input.

## Heart and animation

The animated Heart is optional reinforcement. No task may depend on seeing or understanding its movement. Provide text status and accessible labels. Disable non-essential movement when reduced motion is requested.

## Testing

Before release, test representative journeys using:

- keyboard only;
- a screen reader;
- browser zoom at 200%;
- mobile portrait layout;
- high-contrast settings;
- reduced motion;
- slow network conditions.

Accessibility issues that block booking, help requests, scam checking or account access are release blockers.

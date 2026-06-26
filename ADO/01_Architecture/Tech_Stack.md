# Tech Stack

Status: Not Decided

## Current Position

No technical stack is finalized for TapTim.e yet.

## Reference Stack from frogs

The reference project `frogs-zeiterfassung` uses:

- React Native
- Expo and Expo Router
- Firebase Authentication
- Firebase Firestore
- `react-native-nfc-manager`
- Android NFC intent handling
- JavaScript and JSX

## Technical Lead Position

The frogs stack is a strong candidate because it already contains relevant NFC and Firebase experience.

However, TapTim.e will not inherit the stack automatically. The stack decision must be validated against:

- NFC reliability
- Android real-device behavior
- maintainability
- testing capability
- release process
- long-term scalability
- security requirements

## Required Stack Decision

A dedicated ADR must decide the implementation stack before app code is generated.

Expected ADR:

- `ADR-0002-mobile-and-backend-stack.md`

# Implement Panic Button Visual Feedback (Hold State)

The goal is to provide visual feedback when the user holds the panic button for 2 seconds. The button will change its color to a darker blue and "sink" (reduce elevation/scale) to indicate it is being pressed.

## User Review Required

> [!IMPORTANT]
> The panic button is currently **red** (`@color/urgent_alert`). The request specifies changing it to a **darker blue** when held. I will update the base color to **blue** (`@color/brand`) and the pressed color to **darker blue** (`@color/brand_dark`). Please verify if this shift from Red to Blue is intended for the "Panic" function.

## Proposed Changes

### [Android App]

#### [MODIFY] [ripple_panic_button.xml](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/res/drawable/ripple_panic_button.xml)
Update the drawable to use a `selector` that changes color from `@color/brand` to `@color/brand_dark` when `android:state_pressed="true"`.

#### [NEW] [animator_panic_button.xml](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/res/animator/animator_panic_button.xml)
Create a `stateListAnimator` that reduces `translationZ` or `scaleX`/`scaleY` when the button is pressed to create the "sinking" effect.

#### [MODIFY] [activity_shift.xml](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/res/layout/activity_shift.xml)
Apply the `stateListAnimator` to the `btnPanic` view.

## Verification Plan

### Manual Verification
1. Open the app and go to the Shift screen.
2. Press and hold the Panic button.
3. Observe that the button color changes to a darker blue immediately.
4. Observe that the button visually "sinks" (scales down or drops elevation).
5. Ensure the panic dialog still triggers after 2 seconds.

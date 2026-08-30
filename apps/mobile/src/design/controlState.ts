export type ControlVisualState =
  | 'idle'
  | 'hovered'
  | 'focused'
  | 'pressed'
  | 'disabled'
  | 'loading';

export function resolveControlVisualState(state: Readonly<{
  hovered: boolean;
  focused: boolean;
  pressed: boolean;
  disabled: boolean;
  loading: boolean;
}>): ControlVisualState {
  if (state.loading) return 'loading';
  if (state.disabled) return 'disabled';
  if (state.pressed) return 'pressed';
  if (state.focused) return 'focused';
  if (state.hovered) return 'hovered';
  return 'idle';
}

import { useId, useLayoutEffect, useRef, type ComponentPropsWithRef } from 'react';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLFieldSetElement;
const selector = 'input,select,textarea,fieldset[data-required-choice]';

/** Presents the existing HTML constraints at the field instead of a browser tooltip. */
export function RequiredForm({ onSubmit, onSubmitCapture, onChangeCapture, ref, ...props }: ComponentPropsWithRef<'form'>) {
  const prefix = useId();
  const submitted = useRef(false);
  const element = useRef<HTMLFormElement | null>(null);
  const nextHint = useRef(0);
  const hints = useRef(new Map<Field, HTMLElement>());
  const describe = (field: Field): string => {
    if (field.disabled) return '';
    const custom = field.dataset.fieldError;
    if (custom) return custom;
    if (field instanceof HTMLFieldSetElement) return '';
    const labelNode = field.labels?.[0]?.cloneNode(true) as HTMLElement | undefined;
    labelNode?.querySelectorAll('input,select,textarea,small,.required-field-error').forEach(node => node.remove());
    const label = field.dataset.fieldLabel ?? field.getAttribute('aria-label')
      ?? labelNode?.textContent?.trim() ?? 'dieses Feld';
    if (field.required && (!(field instanceof HTMLInputElement && field.type === 'password' ? field.value : field.value.trim()) || field instanceof HTMLInputElement && field.type === 'radio' && !field.checked))
      return `Bitte ${label} ${field instanceof HTMLSelectElement ? 'wählen' : 'eingeben'}.`;
    if (field.validity.typeMismatch) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
    if (field instanceof HTMLInputElement && field.minLength > 0 && field.value.length > 0 && field.value.length < field.minLength)
      return `Bitte mindestens ${field.minLength} Zeichen eingeben.`;
    return field.validity.valid ? '' : `Bitte ${label} prüfen.`;
  };
  const present = (field: Field, index: number): boolean => {
    const error = describe(field);
    const id = hints.current.get(field)?.id ?? `${prefix}-error-${nextHint.current++}`;
    let hint = hints.current.get(field);
    if (error) {
      if (!hint) {
        hint = document.createElement('span');
        hint.id = id;
        hint.className = 'required-field-error';
        hint.setAttribute('role', 'alert');
        // Keep the hint outside a wrapping label, whose accessible name must stay stable.
        (field.parentElement?.tagName === 'LABEL' ? field.parentElement : field).after(hint);
        hints.current.set(field, hint);
      }
      hint.textContent = error;
      field.setAttribute('aria-invalid', 'true');
      const descriptions = new Set((field.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean));
      descriptions.add(id);
      field.setAttribute('aria-describedby', [...descriptions].join(' '));
    } else {
      hint?.remove();
      hints.current.delete(field);
      field.removeAttribute('aria-invalid');
      const descriptions = (field.getAttribute('aria-describedby') ?? '').split(' ').filter(value => value && value !== id);
      if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '));
      else field.removeAttribute('aria-describedby');
    }
    return !error;
  };
  const fields = (form: HTMLFormElement) => Array.from(form.querySelectorAll<Field>(selector));
  useLayoutEffect(() => {
    for (const [field, hint] of hints.current) {
      if (!element.current?.contains(field)) { hint.remove(); hints.current.delete(field); }
    }
    if (submitted.current && element.current) fields(element.current).forEach((field,index)=>{if(hints.current.has(field))present(field,index);});
  });
  return <form {...props} ref={node => {
    element.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }} noValidate onSubmitCapture={event => {
    submitted.current = true;
    let first: Field | undefined;
    const scope = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-validation-scope');
    fields(event.currentTarget).forEach((field, index) => { if ((!scope || field.id===scope) && !present(field, index)) first ??= field; });
    if (first) {
      event.preventDefault(); event.stopPropagation(); first.focus();
      return;
    }
    onSubmitCapture?.(event);
  }} onSubmit={onSubmit} onChangeCapture={event => {
    if (submitted.current) fields(event.currentTarget).forEach((field, index) => {if(hints.current.has(field))present(field,index);});
    onChangeCapture?.(event);
  }} />;
}

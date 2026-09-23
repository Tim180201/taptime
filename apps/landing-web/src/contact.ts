export function renderContact(box: HTMLElement, address: string): void {
  const slot = document.createElement('div');
  slot.className = 'mail-slot';
  slot.textContent = address || 'E-Mail-Adresse folgt';
  box.replaceChildren(slot);
  if (!address) return;
  const link = document.createElement('a');
  link.className = 'btn btn-primary';
  link.href = `mailto:${address}`;
  link.textContent = 'Pilot per E-Mail anfragen';
  const purpose = document.createElement('p');
  purpose.className = 'note';
  purpose.textContent = 'Wir verwenden Ihre Angaben nur, um Ihre Anfrage zu beantworten.';
  box.append(link, purpose);
}

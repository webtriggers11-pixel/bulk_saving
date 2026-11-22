import { INVITE_CODE_LENGTH } from '@bulk/shared';

/**
 * The words and links that carry a society's invite (FEAT-032, ADR-0043 §4, §7). Pure, so
 * the poster, the QR code, the copy buttons and the WhatsApp link all say the same thing.
 */

/** `<origin>/onboard?code=XXXX`: a phone camera opens the app with the code filled in. */
export function joinLink(origin: string, inviteCode: string): string {
  return `${origin.replace(/\/+$/, '')}/onboard?code=${encodeURIComponent(inviteCode)}`;
}

/** The invitation an admin pastes into the society's WhatsApp group or sends one by one. */
export function invitationMessage(societyName: string, inviteCode: string, link: string): string {
  return [
    `Hi neighbours! ${societyName} is now on Bulk Saving: we book services together and everyone pays less.`,
    '',
    `Join here: ${link}`,
    `Or open the app and enter the invite code: ${inviteCode}`,
    '',
    'Sign-in takes a minute with your phone number.',
  ].join('\n');
}

/** WhatsApp's "send to anyone" link with the message pre-filled; the admin picks the chat. */
export function whatsappShareHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Groups a code for reading aloud and printing: `AB12 CD34`. */
export function spacedCode(inviteCode: string): string {
  return inviteCode.length === INVITE_CODE_LENGTH ? `${inviteCode.slice(0, 4)} ${inviteCode.slice(4)}` : inviteCode;
}

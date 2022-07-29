/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */
import {Strophe, $msg} from 'strophe.js';

export const availabilities = {
  chat: 'Available',
  busy: 'Busy',
  away: 'Away',
  offline: 'Offline',
  invisible: 'Invisible'
};

// Creates a nicer debug output of messages
export const domFromString = str => {
  const el = document.createElement('html');
  el.innerHTML = str;
  return el.getElementsByTagName('body')[0];
};

// Checks if connection settings are valid
export const validConnection = settings => ['host', 'username', 'password']
  .every(key => !!settings[key]);

// Get connection status text
export const getConnectionStatusText = status => Object.keys(Strophe.Status)
  .find(key => Strophe.Status[key] === status) || 'Disconnected';

// Get availability text
export const getAvailabilityText = availability => availabilities[availability] || availability;

// Gets the username from a JID
export const getUsername = jid => jid.split('/')[0];

// Gets the text from a message
export const getMessageText = msg => {
  const body = msg.getElementsByTagName('body');

  if (body.length) {
    return Array.from(body).map(el => Strophe.getText(el))
      .join('\n');
  }

  return '';
};

// Creates a new message
export const createMessage = (from, to, msg) => $msg({to, from, type: 'chat'})
  .cnode(Strophe.xmlElement('body', msg)).up()
  .c('active', {xmlns: 'http://jabber.org/protocol/chatstates'})
  .tree();

// Parses precense message
export const parsePresence = msg => {
  const from = msg.getAttribute('from');
  if (msg.querySelector('error')) {
    throw new Error(getMessageText(msg));
  }

  const show = msg.querySelector('show');
  const xphoto = msg.querySelector('photo');

  const status = show
    ? Strophe.getText(show)
    : null;

  const photo = xphoto
    ? Strophe.getText(xphoto)
    : null;

  return {
    user: getUsername(from),
    photo,
    status
  };
};

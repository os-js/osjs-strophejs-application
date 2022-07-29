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

import {h, app} from 'hyperapp';
import {Strophe} from 'strophe.js';
import {
  Box,
  Menubar,
  MenubarItem,
  Statusbar,
  listView
} from '@osjs/gui';
import {getAvailabilityText, parsePresence, getConnectionStatusText} from './utils.js';

const createStatusMenuItem = (state, actions, availability) => ({
  type: 'checkbox',
  label: getAvailabilityText(availability),
  disabled: !state.connected,
  checked: state.availability === availability,
  onclick: () => actions.menuSetStatus(availability)
});

const createFileMenu = (state, actions) => ([
  {label: 'Connection Options', onclick: () => actions.menuOptions()},
  {label: 'Connect', disabled: state.connected, onclick: () => actions.menuConnect()},
  {label: 'Disconnect', disabled: !state.connected, onclick: () => actions.menuDisconnect()},
  {label: 'Quit', onclick: () => actions.menuQuit()}
]);

const createStatusMenu = (state, actions, bus) => ([
  createStatusMenuItem(state, actions, 'chat'),
  createStatusMenuItem(state, actions, 'busy'),
  createStatusMenuItem(state, actions, 'away'),
  createStatusMenuItem(state, actions, 'offline'),
  createStatusMenuItem(state, actions, 'invisible'),
]);

export const createMainWindow = (core, proc, bus) => {
  const win = proc.createWindow({
    id: 'StropheJSMainWindow',
    icon: proc.resource(proc.metadata.icon),
    title: proc.metadata.title.en_EN,
    dimension: {width: 400, height: 400},
    attributes: {closeable: false, visibility: 'restricted'}
  });

  const view = (state, actions) => {
    const ContactView = listView.component(state.contacts, actions.contacts);

    return h(Box, {}, [
      h(Menubar, {}, [
        h(MenubarItem, {
          onclick: ev => actions.menuFile(ev)
        }, 'File'),
        h(MenubarItem, {
          onclick: ev => actions.menuStatus(ev)
        }, 'Status')
      ]),
      h(ContactView, {box: {shrink: 1, grow: 1}}),
      h(Statusbar, {}, [
        `${getConnectionStatusText(state.status)} - ${getAvailabilityText(state.availability)}`
      ])
    ]);
  };

  win.render($content => {
    const a = app({
      connected: false,
      availability: 'chat',
      status: -1,
      contacts: listView.state({
        rows: [],
        columns: [{
          label: 'Name'
        }, {
          label: 'Status'
        }]
      })
    }, {
      menuOptions: () => () => bus.emit('open-connection-window'),
      menuConnect: () => () => bus.emit('connect'),
      menuDisconnect: () => () => bus.emit('disconnect'),
      menuQuit: () => () => proc.destroy(),
      menuFile: ev => (state, actions) => {
        core.make('osjs/contextmenu').show({
          position: ev.target,
          menu: createFileMenu(state, actions)
        });
      },
      menuStatus: ev => (state, actions) => {
        core.make('osjs/contextmenu').show({
          position: ev.target,
          menu: createStatusMenu(state, actions)
        });
      },
      menuSetStatus: status => (state, actions) => {
        bus.emit('set-status', status);
      },
      getContacts: () => state => state.contacts.rows,
      setAvailability: availability => state => ({availability}),
      getStatus: () => state => state.status,
      setStatus: status => state => {
        const connected = status === Strophe.Status.CONNECTED;
        return {connected, status};
      },
      contacts: listView.actions({
        select: ({data}) => {},
        activate: ({data}) => bus.emit('open-chat-window', data.user)
      }),
    }, view, $content);

    bus.on('presence', pres => {
      const contacts = a.getContacts();

      try {
        const contact = parsePresence(pres);
        const foundIndex = contacts.findIndex(c => c.data.user === contact.user);

        const iter = {
          columns: [contact.user, getAvailabilityText(contact.status || 'offline')],
          data: contact
        };

        if (foundIndex === -1) {
          contacts.push(iter);
        } else {
          contacts[foundIndex] = iter;
        }

        a.contacts.setRows(contacts);
      } catch (e) {
        console.warn(e);
      }
    });

    bus.on('status-change', status => a.setStatus(status));
    bus.on('availability-change', availability => a.setAvailability(availability));
    bus.on('disconnected', () => a.setStatus(-1));
  });

  return win;
};

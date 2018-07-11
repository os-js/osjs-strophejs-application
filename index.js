/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2018, Anders Evenrud <andersevenrud@gmail.com>
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
import {$pres, $msg, Strophe} from 'strophe.js';
import {
  Box,
  BoxStyled,
  BoxContainer,
  Menubar,
  MenubarItem,
  Button,
  TextareaField,
  TextField,
  Toolbar,
  Statusbar,
  listView
} from '@osjs/gui';

// Checks if connection settings are valid
const validConnection = settings => ['host', 'username', 'password']
  .every(key => !!settings[key]);

// Gets the connection status text
const getStatusText = status => Object.keys(Strophe.Status)
  .find(key => Strophe.Status[key] === status) || 'Disconnected';

// Gets the username from a JID
const getUsername = jid => jid.split('/')[0];

// Gets the text from a message
const getMessageText = msg => {
  const body = msg.getElementsByTagName('body');

  if (body.length) {
    return Array.from(body).map(el => Strophe.getText(el))
      .join('\n');
  }

  return '';
};

// Creates a new message
const createMessage = (from, to, msg) => $msg({to, from, type: 'chat'})
  .cnode(Strophe.xmlElement('body', msg)).up()
  .c('active', {xmlns: 'http://jabber.org/protocol/chatstates'})
  .tree();

// Parses precense message
const parsePresence = msg => {
  const from = msg.getAttribute('from');
  if (msg.querySelector('error')) {
    throw new Error(getStatusText(msg));
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

// Chat message component
const ChatMessage = ({self, from, body, date}) => h('div', {
  class: ['chat-message', self ? 'chat-message-self' : 'chat-message-other'].join(' ')
}, [
  h('div', {class: 'chat-message-date'}, date),
  h('div', {class: 'chat-message-from'}, getUsername(from)),
  h('div', {class: 'chat-message-body'}, body)
]);

// Chat Window
const createChatWindow = (core, proc, parent, bus, options) => {
  const {format} = core.make('osjs/locale');

  const win = proc.createWindow({
    id: options.id,
    title: options.title,
    icon: proc.resource(proc.metadata.icon),
    parent,
    attributes: {classNames: ['StropheJSChatWindow']},
    dimension: {width: 400, height: 300}
  });

  const messages = (state, actions) => state.messages.map(({date, msg}) => {
    return h(ChatMessage, {
      date: format(date, 'fullDate'),
      self: getUsername(msg.getAttribute('from')) !== getUsername(options.user),
      to: msg.getAttribute('to'),
      from: msg.getAttribute('from'),
      type: msg.getAttribute('type'),
      body: getMessageText(msg)
    });
  });

  const getLastStamp = state => {
    const last = state.messages.length > 0
      ? state.messages[state.messages.length - 1]
      : null;

    return last
      ? `Last message: ${format(last.date)}`
      : 'Conversation started...';
  };

  const view = (state, actions) => h(Box, {}, [
    h(BoxStyled, {
      grow: 1,
      shrink: 1,
      class: 'chat-messages',
      orientation: 'horizontal'
    }, [
      ...messages(state, actions)
    ]),
    h(BoxContainer, {}, [
      h(TextareaField, {
        box: {grow: 1},
        rows: 2,
        placeholder: 'Enter message and use shift+enter to send...',
        onenter: ev => {
          if (ev.shiftKey) {
            actions.send();
          }
        }
      }),
      h(Button, {
        onclick: () => actions.send()
      }, 'Send')
    ]),
    h(Statusbar, {}, [
      state.typing ? `${options.title} is typing...` : getLastStamp(state)
    ])
  ]);

  win.render($content => {
    const a = app({
      typing: false,
      messages: []
    }, {
      send: () => (state, actions) => {
        const textarea = $content.querySelector('textarea');
        const value = textarea.value.trim();
        if (!value.length) {
          return;
        }

        const msg = createMessage(options.self, options.user, value);

        actions.sendMessage(msg);
        actions.addMessage({date: new Date(), msg});

        setTimeout(() => (textarea.value = ''), 1);
      },
      setTypeStatus: typing => () => ({typing}),
      sendMessage: msg => () => bus.emit('send-message', msg),
      addMessage: obj => state => ({messages: [...state.messages, obj]})
    }, view, $content);

    let typeStatusTimeout;

    win.on('strophejs/message', msg => {
      a.addMessage({date: new Date(), msg});

      const container = $content.querySelector('.chat-messages');
      if (container) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 1);
      }
    });

    win.on('strophejs/started-typing', () => {
      clearTimeout(typeStatusTimeout);
      typeStatusTimeout = setTimeout(() => {
        a.setTypeStatus(false);
      }, 1000);

      a.setTypeStatus(true);
    });
    win.on('strophejs/stopped-typing', () => a.setTypeStatus(false));
  });

  return win;
};

// Connection Window
const createConnectionWindow = (core, proc, parent, bus) => {
  const win = proc.createWindow({
    parent,
    icon: proc.resource(proc.metadata.icon),
    title: 'XMPP Connection Options',
    id: 'StropheJSConnectionWindow',
    dimension: {width: 400, height: 400},
    attributes: {sessionable: false}
  });

  const state = Object.assign({}, proc.settings);

  const view = (state, actions) => h(Box, {}, [
    h(Box, {grow: 1}, [
      h(BoxContainer, {orientation: 'horizontal'}, [
        h('div', {}, 'Host:'),
        h(TextField, {value: state.host, oninput: (ev, value) => actions.setHost(value)})
      ]),
      h(BoxContainer, {orientation: 'horizontal'}, [
        h('div', {}, 'Username:'),
        h(TextField, {value: state.username, oninput: (ev, value) => actions.setusername(value)})
      ]),
      h(BoxContainer, {orientation: 'horizontal'}, [
        h('div', {}, 'Password:'),
        h(TextField, {type: 'password', value: state.password, oninput: (ev, value) => actions.setpassword(value)})
      ])
    ]),
    h(Toolbar, {justify: 'flex-end'}, [
      h(Button, {onclick: () => actions.connect()}, 'Connect'),
      h(Button, {onclick: () => actions.close()}, 'Close')
    ])
  ]);

  win.render($content => app(state, {
    setHost: host => state => ({host}),
    setUsername: username => state => ({username}),
    setPassword: password => state => ({password}),
    connect: () => (state) => {
      bus.emit('set-connection', state, true);
      win.destroy();
    },
    close: () => () => {
      win.destroy();
    }
  }, view, $content));

  win.focus();

  return win;
};

// Main Window
const createMainWindow = (core, proc, bus) => {
  const win = proc.createWindow({
    id: 'StropheJSMainWindow',
    icon: proc.resource(proc.metadata.icon),
    title: proc.metadata.title.en_EN,
    dimension: {width: 400, height: 400}
  });

  const view = (state, actions) => {
    const ContactView = listView.component(state.contacts, actions.contacts);

    return h(Box, {}, [
      h(Menubar, {}, [
        h(MenubarItem, {}, 'File'),
        h(MenubarItem, {onclick: () => actions.configure()}, 'Connection'),
        h(MenubarItem, {}, 'Status')
      ]),
      h(ContactView, {box: {shrink: 1, grow: 1}}),
      h(Statusbar, {}, getStatusText(state.status))
    ]);
  };

  win.on('destroy', () => proc.destroy());

  win.render($content => {
    const a = app({
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
      configure: () => () => bus.emit('open-connection-window'),
      getContacts: () => state => state.contacts.rows,
      setStatus: status => state => ({status}),
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
          columns: [contact.user, contact.status],
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
  });

  return win;
};

// Connection Window
const createConnection = (core, proc, bus) => {
  const {host, username, password} = proc.settings;
  try {
    const connection = new Strophe.Connection(host);
    connection.rawInput = d => console.log('input', d);
    connection.rawOutput = d => console.log('output', d);

    const cb = (status) => {
      bus.emit('status-change', status);

      if (status === Strophe.Status.CONNECTED) {
        bus.emit('connected');
      }
    };

    try {
      connection.restore(null, cb);
    } catch (e) {
      console.warn(e);
      connection.connect(username, password, cb);
    }

    connection.addHandler(msg => bus.emit('receive-message', msg), null, 'message', null, null,  null); 
    connection.addHandler(pres => bus.emit('presence', pres), null, 'presence', null, null,  null); 
    connection.addHandler(() => true, 'jabber:iq:roster', 'iq', 'set'); 

    return connection;
  } catch (e) {
    console.error(e);
  }

  return null;
};

// Main Application
const createApplication = (core, proc) => {
  let connection;
  const bus = core.make('osjs/event-handler', 'Strophe.js');
  const win = createMainWindow(core, proc, bus);

  const disconnect = () => {
    if (connection) {
      connection.disconnect();
    }
    connection = null;
  };

  const findChatWindow = from => {
    const username = getUsername(from);
    const id = 'StropheJSChatWindow_' + username;

    return proc.windows.find(win => win.id === id);
  };

  const findOrCreateChatWindow = from => {
    let chatWindow = findChatWindow(from);
    if (!chatWindow) {
      const username = getUsername(from);
      const id = 'StropheJSChatWindow_' + username;

      chatWindow = createChatWindow(core, proc, win, bus, {
        id,
        self: connection.jid,
        title: username,
        user: from
      });
    }

    return chatWindow;
  };

  bus.on('open-connection-window', () => createConnectionWindow(core, proc, win, bus));

  bus.on('open-chat-window', from => findOrCreateChatWindow(from).focus());

  bus.on('send-message', msg => connection.send(msg));

  bus.on('receive-message', msg => {
    const from = msg.getAttribute('from');
    const isTyping  = msg.getElementsByTagName('cha:composing').length > 0;
    const isPaused = msg.getElementsByTagName('cha:paused').length > 0;
    const isMessage = msg.getElementsByTagName('body').length > 0;

    if (isTyping || isPaused) {
      let chatWindow = findChatWindow(from);
      if (chatWindow) {
        chatWindow.emit(isTyping ? 'strophejs/started-typing' : 'strophejs/stopped-typing');
      }
    }

    if (isMessage) {
      let chatWindow = findOrCreateChatWindow(from);
      chatWindow.emit('strophejs/message', msg);
    }
  });

  bus.on('set-status', (status, text) => {
    const pres = $pres({
      from: connection.jid,
      show: status
    });

    if (text) {
      pres.c('status', text);
    }

    connection.send(pres.tree());
  });

  bus.on('set-connection', (settings, connect) => {
    Object.assign(proc.settings, settings);
    proc.saveSettings();

    if (connect) {
      bus.emit('connect');
    }
  });

  bus.on('connected', () => bus.emit('set-status', 'chat'));

  bus.on('disconnect', () => disconnect());

  bus.on('connect', () => {
    disconnect();
    connection = createConnection(core, proc, bus);
  });

  if (validConnection(proc.settings)) {
    bus.emit('connect');
  } else {
    bus.emit('open-connection-window');
  }

  proc.on('destroy', () => disconnect());
  proc.on('destroy', () => bus.off());
};

// Base
const create = (core, args, options, metadata) => {
  const proc = core.make('osjs/application', {
    args,
    options: Object.assign({
      settings: {
        host: 'http://localhost:5280/http-bind',
        username: 'username@gmail.com',
        password: ''
      }
    }, options),
    metadata
  });

  createApplication(core, proc);

  return proc;
};

OSjs.make('osjs/packages').register('StropheJS', create);

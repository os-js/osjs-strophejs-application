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
import {$pres, Strophe} from 'strophe.js';
import {createConnectionWindow} from './connection-window.js';
import {createChatWindow} from './chat-window.js';
import {createMainWindow} from './main-window.js';
import {getUsername, domFromString, validConnection} from './utils.js';

const createConnection = (core, proc, bus) => {
  const {host, username, password} = proc.settings;
  try {
    const connection = new Strophe.Connection(host);
    connection.rawInput = d => console.debug('input', domFromString(d));
    connection.rawOutput = d => console.debug('output', domFromString(d));

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

    connection.addHandler(msg => bus.emit('receive-message', msg), null, 'message', null, null, null);
    connection.addHandler(pres => bus.emit('presence', pres), null, 'presence', null, null, null);
    connection.addHandler(() => true, 'jabber:iq:roster', 'iq', 'set');

    return connection;
  } catch (e) {
    console.error(e);
  }

  return null;
};

const createApplication = (core, proc) => {
  let connection;
  const bus = core.make('osjs/event-emitter', 'Strophe.js');
  const win = createMainWindow(core, proc, bus);
  const tray = core.make('osjs/tray').create({
    title: 'Strophe.js',
    icon: proc.resource(proc.metadata.icon),
  }, () => {
    win.raise();
    win.focus();
  });

  const onConnected = () => bus.emit('set-status', 'chat');

  const onDisconnect = () => {
    if (connection) {
      connection.disconnect();
    }
    connection = null;

    bus.emit('disconnected');
  };

  const onConnect = () => {
    onDisconnect();
    connection = createConnection(core, proc, bus);
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

  const onReceiveMessage = msg => {
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
  };

  const onSetStatus = (status, text) => {
    const pres = $pres({
      from: connection.jid
    });

    pres.c('show', status);

    if (text) {
      pres.c('status', text);
    }

    connection.send(pres.tree());

    // FIXME: Mayne it's just google hangouts, but we really want to set the status
    // from a server message
    bus.emit('availability-change', status);
  };

  const onSetConnection = (settings, connect) => {
    Object.assign(proc.settings, settings);
    proc.saveSettings();

    if (connect) {
      bus.emit('connect');
    }
  };

  bus.on('open-connection-window', () => createConnectionWindow(core, proc, win, bus));
  bus.on('open-chat-window', from => findOrCreateChatWindow(from).focus());
  bus.on('send-message', msg => connection.send(msg));
  bus.on('receive-message', onReceiveMessage);
  bus.on('set-status', onSetStatus);
  bus.on('set-connection', onSetConnection);
  bus.on('connected', onConnected);
  bus.on('disconnect', onDisconnect);
  bus.on('connect', onConnect);
  proc.on('destroy', onDisconnect);
  proc.on('destroy', () => bus.off());
  proc.on('destroy', () => tray.destroy());
  win.on('destroy', () => proc.destroy());

  if (validConnection(proc.settings)) {
    bus.emit('connect');
  } else {
    bus.emit('open-connection-window');
  }
};

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

export default create;

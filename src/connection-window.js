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
import {
  Box,
  BoxContainer,
  Button,
  TextField,
  Toolbar
} from '@osjs/gui';

export const createConnectionWindow = (core, proc, parent, bus) => {
  const win = proc.createWindow({
    parent,
    icon: proc.resource(proc.metadata.icon),
    title: 'XMPP Connection Options',
    id: 'StropheJSConnectionWindow',
    dimension: {width: 400, height: 400},
    attributes: {sessionable: false}
  });

  const view = (state, actions) => h(Box, {}, [
    h(Box, {grow: 1}, [
      h(BoxContainer, {orientation: 'horizontal'}, [
        h('div', {}, 'Host:'),
        h(TextField, {value: state.host, oninput: (ev, value) => actions.setHost(value)})
      ]),
      h(BoxContainer, {orientation: 'horizontal'}, [
        h('div', {}, 'Username:'),
        h(TextField, {value: state.username, oninput: (ev, value) => actions.setUsername(value)})
      ]),
      h(BoxContainer, {orientation: 'horizontal'}, [
        h('div', {}, 'Password:'),
        h(TextField, {type: 'password', value: state.password, oninput: (ev, value) => actions.setPassword(value)})
      ])
    ]),
    h(Toolbar, {justify: 'flex-end'}, [
      h(Button, {onclick: () => actions.connect()}, 'Connect'),
      h(Button, {onclick: () => actions.close()}, 'Close')
    ])
  ]);

  win.render($content => app(Object.assign({}, proc.settings), {
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

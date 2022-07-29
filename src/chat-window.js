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
  BoxStyled,
  BoxContainer,
  Button,
  TextareaField,
  Statusbar
} from '@osjs/gui';
import {getUsername, getMessageText, createMessage} from './utils.js';

const ChatMessage = ({self, from, body, date}) => h('div', {
  class: ['chat-message', self ? 'chat-message-self' : 'chat-message-other'].join(' ')
}, [
  h('div', {
    class: 'chat-message__header'
  }, [
    h('div', {class: 'chat-message__header--date'}, `${date} - `),
    h('div', {class: 'chat-message__header--username'}, `${getUsername(from)}:`)
  ]),
  h('div', {
    class: 'chat-message__body'
  }, body)
]);

export const createChatWindow = (core, proc, parent, bus, options) => {
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
      date: format(date, 'longTime'),
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

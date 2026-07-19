import { JSX } from 'solid-js';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';

export function NotificationManager(props: { children: JSX.Element }) {
  return (
    <NotificationProvider>
      {props.children}
    </NotificationProvider>
  );
}

export { useNotifications };

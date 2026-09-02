import { onMount, JSX } from 'solid-js';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';

export function NotificationManager(props: { children: JSX.Element }) {
  onMount(() => {
    console.log("NotificationManager mounted");
  });
  return <>{props.children}</>;
}

export { useNotifications };

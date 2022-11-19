import styles from './styles.module.scss';
import Icon from '@/components/ui/icon/Icon';
import Avatar from '@/components/ui/Avatar';
import RouterEndpoints from '../../common/RouterEndpoints';
import { classNames, conditionalClass } from '@/common/classNames';
import ContextMenuServer from '@/components/servers/context-menu/ContextMenuServer';
import { createEffect, createResource, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import useStore from '../../chat-api/store/useStore';
import { Link, useLocation, useParams, useMatch } from '@nerimity/solid-router';
import { FriendStatus } from '../../chat-api/RawData';
import Modal from '@/components/ui/Modal';
import AddServer from './add-server/AddServer';
import { userStatusDetail } from '../../common/userStatus';
import { Server } from '../../chat-api/store/useServers';
import { useCustomPortal } from '../ui/custom-portal/CustomPortal';
import { hasBit, USER_BADGES } from '@/chat-api/Bitwise';
import { updateTitleAlert } from '@/common/BrowserTitle';
import { ConnectionErrorModal } from '../ConnectionErrorModal';
import ItemContainer from '../ui/Item';
import { styled } from 'solid-styled-components';
import { useAppVersion } from '@/common/useAppVersion';
import { useWindowProperties } from '@/common/useWindowProperties';
import { FlexColumn, FlexRow } from '../ui/Flexbox';
import Button from '../ui/Button';
import Text from '../ui/Text';
import Marked from '@/common/Marked';
import { getLatestRelease } from '@/github-api';
import { formatTimestamp } from '@/common/date';

const SidebarItemContainer = styled(ItemContainer)`
  align-items: center;
  justify-content: center;
  height: 50px;
  width: 60px;
`;

export default function SidePane () {
  const createPortal = useCustomPortal();

  const showAddServerModal = () => {
    createPortal?.(close => <Modal {...close} title="Add Server" children={() => <AddServer close={close} />} />)
  }

  return <div class={styles.sidePane}>
    <InboxItem />
    <div class={styles.scrollable}>
      <ServerList />
      <SidebarItemContainer onClick={showAddServerModal} >
        <Icon name="add_box" size={40} />
      </SidebarItemContainer>
    </div>
    <UpdateItem/>
    <ModerationItem />
    <SettingsItem />
    <UserItem />
  </div>
}

function InboxItem() {
  const {inbox, friends, servers} = useStore();
  const location = useLocation();
  const isSelected = () => location.pathname.startsWith(RouterEndpoints.INBOX());
  const notificationCount = () => inbox.notificationCount(); 
  const friendRequestCount = () => friends.array().filter(friend => friend.status === FriendStatus.PENDING).length;

  const count = () => (notificationCount() + friendRequestCount());

  createEffect(() => {
    updateTitleAlert(count() || servers.hasNotifications() ? true : false);
  })

  return (
  <Link href={RouterEndpoints.INBOX()} style={{"text-decoration": "none"}}>
      <SidebarItemContainer selected={isSelected()} alert={(count())}>
        <Show when={count()}><div class={styles.notificationCount}>{count()}</div></Show>
        <Icon name='all_inbox' />
      </SidebarItemContainer>
  </Link>
  )
}

function UpdateItem() {
  const checkAfterMS = 600000; // 10 minutes
  const {checkForUpdate, updateAvailable} = useAppVersion();
  const createPortal = useCustomPortal();
  const {hasFocus} = useWindowProperties()
  let lastChecked = 0;

  createEffect(on(hasFocus, async () => {
    if (updateAvailable()) return;
    const now = Date.now();
    if (now - lastChecked >= checkAfterMS) {
      lastChecked = now;
      checkForUpdate();
    }
  }))

  const showUpdateModal = () => createPortal?.(close => <Modal title='Update Available'><UpdateModal close={close}/></Modal>)

  return (
    <Show when={updateAvailable()}>
      <SidebarItemContainer onclick={showUpdateModal}>
        <Icon name='get_app' title='Update Available' color="var(--success-color)" />
      </SidebarItemContainer>
    </Show>
  )
}
function ModerationItem() {
  const {account} = useStore();
  const hasModeratorPerm = () => hasBit(account.user()?.badges || 0, USER_BADGES.CREATOR.bit) || hasBit(account.user()?.badges || 0, USER_BADGES.ADMIN.bit)

  const selected = useMatch(() => "/app/moderation");

  return (
    <Show when={hasModeratorPerm()}>
      <Link href="/app/moderation" style={{"text-decoration": "none"}} >
        <SidebarItemContainer selected={selected()}>
          <Icon name='security' title='Moderation' />
        </SidebarItemContainer>
      </Link>
    </Show>
  )
}

function SettingsItem() {
  return <SidebarItemContainer>
    <Icon name='settings' title='Settings' />
  </SidebarItemContainer>
}

const UserItem = () => {
  const {account, users} = useStore();
  const createPortal = useCustomPortal();

  const userId = () =>  account.user()?.id;
  const user = () => users.get(userId()!)
  const presenceColor = () => user() && userStatusDetail(user().presence?.status || 0).color

  const isAuthenticated = account.isAuthenticated;
  const authErrorMessage = account.authenticationError;
  const isConnected = account.isConnected;

  const isAuthenticating = () => !isAuthenticated() && isConnected();
  const showConnecting = () => !authErrorMessage() && !isAuthenticated() && !isAuthenticating();
  const href = () => userId() ? RouterEndpoints.PROFILE(userId()!) : "#";

  const onClicked = () => {
    if (authErrorMessage()) {
      createPortal?.(close => <ConnectionErrorModal close={close} />)
    }
  }

  const selected = useMatch(href);


  return (
    <Link onclick={onClicked} href={href()} class={styles.user}>
      <SidebarItemContainer selected={selected()}>
      {account.user() && <Avatar size={35} hexColor={account.user()?.hexColor!} />}
      {!showConnecting() && <div class={styles.presence} style={{background: presenceColor()}} />}
      {showConnecting() && <Icon name='autorenew' class={styles.connectingIcon} size={24} />}
      {isAuthenticating() && <Icon name='autorenew' class={classNames(styles.connectingIcon, styles.authenticatingIcon)} size={24} />}
      {authErrorMessage() && <Icon name='error' class={styles.errorIcon} size={24} />}
      </SidebarItemContainer>
    </Link>
  )
};

function ServerItem(props: {server: Server, onContextMenu?: (e: MouseEvent) => void}) {
  const { id, defaultChannelId } = props.server;
  const hasNotifications = () => props.server.hasNotifications;
  const selected = useMatch(() => RouterEndpoints.SERVER(id));

  return (
    <Link
      href={RouterEndpoints.SERVER_MESSAGES(id, defaultChannelId)}
      onContextMenu={props.onContextMenu}>
    <SidebarItemContainer alert={hasNotifications()}  selected={selected()}>
      <Avatar size={35} hexColor={props.server.hexColor} />
    </SidebarItemContainer>
    </Link>
  )
}

const ServerList = () => {
  const {servers} = useStore();
  const [contextPosition, setContextPosition] = createSignal<{x: number, y: number} | undefined>();
  const [contextServerId, setContextServerId] = createSignal<string | undefined>();

  const onContextMenu = (event: MouseEvent, serverId: string) => {
    event.preventDefault();
    setContextServerId(serverId);
    setContextPosition({x: event.clientX, y: event.clientY});
  }

  return <div class={styles.serverList}>
    <ContextMenuServer position={contextPosition()} onClose={() => setContextPosition(undefined)} serverId={contextServerId()} />
    <For each={servers.array()}>
      {server => <ServerItem 
        server={server!}
        onContextMenu={e => onContextMenu(e, server!.id)}
      />}
    </For>
  </div>
};


function UpdateModal (props: {close: () => void}) {
  const {latestRelease} = useAppVersion();

  const date = () => {
    const release = latestRelease();
    if (!release) return undefined;
    return formatTimestamp(new Date(release.published_at).getTime())
  }

  return (
    <FlexColumn gap={5}>
      <FlexColumn style={{"max-height": "300px", "max-width": "500px", overflow: "auto"}}>
        <Text size={24}>{latestRelease()?.name || ""}</Text>
        <Text opacity={0.7}>Released at {date() || ""}</Text>
        <Text opacity={0.7}>{latestRelease()?.tag_name}</Text>
        <Marked value={latestRelease()?.body!} />
      </FlexColumn>
      <FlexRow style={{"margin-left": "-5px"}}>
        <Button iconName='close' onClick={props.close} label='Later' color='var(--alert-color)'/>
        <Button iconName='get_app' label='Update Now' onClick={() => location.reload()} primary/>
      </FlexRow>
    </FlexColumn>
  )
}
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '../../components';
import {
	createConversation,
	getChatRecipients,
	getConversationMessages,
	getMessages,
	markConversationAsRead,
	sendMessage,
} from '../../services';
import { useAuth, useChat } from '../../context';
import theme from '../../theme';

function safeList(data) {
	if (Array.isArray(data?.data)) {
		return data.data;
	}

	if (Array.isArray(data)) {
		return data;
	}

	return [];
}

function formatTimeLabel(rawValue) {
	if (!rawValue) {
		return '';
	}

	const date = new Date(rawValue);
	if (Number.isNaN(date.getTime())) {
		return '';
	}

	return date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

function formatMessageTimestamp(rawValue) {
	if (!rawValue) {
		return '';
	}

	const date = new Date(rawValue);
	if (Number.isNaN(date.getTime())) {
		return '';
	}

	const day = date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	});

	const time = date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});

	return `${day} • ${time}`;
}

function formatDateDividerLabel(rawValue) {
	const date = new Date(rawValue);
	if (Number.isNaN(date.getTime())) {
		return '';
	}

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

function dateKey(rawValue) {
	const date = new Date(rawValue);
	if (Number.isNaN(date.getTime())) {
		return '';
	}

	return date.toISOString().slice(0, 10);
}

function userInitials(name) {
	const chunks = String(name || '').trim().split(/\s+/).filter(Boolean);
	if (!chunks.length) {
		return 'U';
	}

	if (chunks.length === 1) {
		return chunks[0].slice(0, 2).toUpperCase();
	}

	return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}

function normalizeName(value) {
	return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildNameCandidates(value) {
	const raw = String(value || '').trim();
	if (!raw) {
		return [];
	}

	const parts = raw
		.split(/[•|\/,-]/)
		.map((item) => normalizeName(item))
		.filter(Boolean);

	const full = normalizeName(raw);
	return Array.from(new Set([full, ...parts]));
}

function findConversationByName(conversationList, participantName) {
	const candidates = buildNameCandidates(participantName);
	if (!candidates.length) {
		return null;
	}

	for (const conversation of conversationList) {
		const otherName = normalizeName(conversation?.other_participant?.name);
		if (!otherName) {
			continue;
		}

		if (candidates.includes(otherName)) {
			return conversation;
		}
	}

	for (const conversation of conversationList) {
		const otherName = normalizeName(conversation?.other_participant?.name);
		if (!otherName) {
			continue;
		}

		if (candidates.some((candidate) => candidate && (otherName.includes(candidate) || candidate.includes(otherName)))) {
			return conversation;
		}
	}

	return null;
}

export default function MessagesScreen({ navigation }) {
	const { user } = useAuth();
	const route = useRoute();
	const { refreshUnreadCount } = useChat();
	const listRef = useRef(null);
	const selectedRecipientId = route?.params?.recipientId;
	const selectedParticipantName = String(route?.params?.participantName || '').trim();
	const selectedChatIntentAt = route?.params?.chatIntentAt;

	const [conversations, setConversations] = useState([]);
	const [recipients, setRecipients] = useState([]);
	const [recipientModalOpen, setRecipientModalOpen] = useState(false);
	const [recipientSearch, setRecipientSearch] = useState('');
	const [selectedConversationId, setSelectedConversationId] = useState(null);
	const [messages, setMessages] = useState([]);
	const [draft, setDraft] = useState('');
	const [isLoadingConversations, setIsLoadingConversations] = useState(true);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [isSendingMessage, setIsSendingMessage] = useState(false);
	const [isPreparingConversation, setIsPreparingConversation] = useState(false);
	const [screenError, setScreenError] = useState('');

	const fetchConversations = useCallback(async () => {
		const payload = await getMessages();
		const nextConversations = safeList(payload)
			.slice()
			.sort((a, b) => new Date(b?.latest_message_at || 0) - new Date(a?.latest_message_at || 0));

		setConversations(nextConversations);
		return nextConversations;
	}, []);

	const fetchRecipients = useCallback(async () => {
		const payload = await getChatRecipients();
		const nextRecipients = safeList(payload);
		setRecipients(nextRecipients);
	}, []);

	const fetchConversationMessages = useCallback(
		async (conversationId) => {
			if (!conversationId) {
				setMessages([]);
				return;
			}

			setIsLoadingMessages(true);
			try {
				const payload = await getConversationMessages(conversationId);
				const nextMessages = safeList(payload).sort(
					(a, b) => new Date(a?.created_at || 0) - new Date(b?.created_at || 0)
				);

				setMessages(nextMessages);
				await markConversationAsRead(conversationId);

				setConversations((prev) =>
					prev.map((conversation) =>
						conversation.id === conversationId
							? {
									...conversation,
									unread_count: 0,
								}
							: conversation
					)
				);

				refreshUnreadCount();
			} finally {
				setIsLoadingMessages(false);
			}
		},
		[refreshUnreadCount]
	);

	const startConversation = useCallback(
		async (recipientId) => {
			if (!recipientId) {
				return;
			}

			setIsPreparingConversation(true);
			setScreenError('');

			try {
				const payload = await createConversation(recipientId);
				const targetConversationId = payload?.data?.id;

				const refreshedConversations = await fetchConversations();
				const resolvedConversation = refreshedConversations.find(
					(item) => item.id === targetConversationId
				);

				const fallbackConversation = refreshedConversations.find(
					(item) => Number(item?.other_participant?.id) === Number(recipientId)
				);

				const nextConversationId = resolvedConversation?.id || fallbackConversation?.id;

				if (nextConversationId) {
					setSelectedConversationId(nextConversationId);
					await fetchConversationMessages(nextConversationId);
				}
			} catch (error) {
				setScreenError(error?.response?.data?.message || 'Unable to start conversation right now.');
			} finally {
				setIsPreparingConversation(false);
			}
		},
		[fetchConversationMessages, fetchConversations]
	);

	const bootstrap = useCallback(async () => {
		setIsLoadingConversations(true);
		setScreenError('');

		try {
			const [conversationList] = await Promise.all([fetchConversations(), fetchRecipients()]);
			const matchedByRecipient = selectedRecipientId
				? conversationList.find(
						(conversation) =>
							Number(conversation?.other_participant?.id) === Number(selectedRecipientId)
				  )
				: null;
			const matchedByName = !matchedByRecipient
				? findConversationByName(conversationList, selectedParticipantName)
				: null;
			const hasSelected = conversationList.some(
				(conversation) => Number(conversation?.id) === Number(selectedConversationId)
			);
			const nextSelected =
				matchedByRecipient?.id ||
				matchedByName?.id ||
				(hasSelected ? selectedConversationId : conversationList[0]?.id || null);

			setSelectedConversationId(nextSelected);

			if (nextSelected) {
				await fetchConversationMessages(nextSelected);
			} else {
				setMessages([]);
			}
		} catch (error) {
			setScreenError(error?.response?.data?.message || 'Unable to load chats right now.');
		} finally {
			setIsLoadingConversations(false);
		}
	}, [
		fetchConversationMessages,
		fetchConversations,
		fetchRecipients,
		selectedConversationId,
		selectedParticipantName,
		selectedRecipientId,
	]);

	useFocusEffect(
		useCallback(() => {
			bootstrap();
		}, [bootstrap])
	);

	useEffect(() => {
		if (!selectedRecipientId && !selectedParticipantName) {
			return;
		}

		let isCancelled = false;

		const syncIncomingTarget = async () => {
			try {
				const latestConversations = await fetchConversations();

				if (isCancelled) {
					return;
				}

				const matchedByRecipient = selectedRecipientId
					? latestConversations.find(
							(conversation) =>
								Number(conversation?.other_participant?.id) === Number(selectedRecipientId)
						  )
					: null;
				const matchedByName = matchedByRecipient
					? null
					: findConversationByName(latestConversations, selectedParticipantName);

				const targetConversationId = matchedByRecipient?.id || matchedByName?.id || null;
				if (targetConversationId) {
					setSelectedConversationId(targetConversationId);
					await fetchConversationMessages(targetConversationId);
					return;
				}

				if (selectedRecipientId) {
					await startConversation(selectedRecipientId);
				}
			} catch {
				// Keep the current thread visible if target lookup fails.
			}
		};

		syncIncomingTarget();

		return () => {
			isCancelled = true;
		};
	}, [
		fetchConversationMessages,
		fetchConversations,
		selectedChatIntentAt,
		selectedParticipantName,
		selectedRecipientId,
		startConversation,
	]);

	useEffect(() => {
		if (!messages.length) {
			return;
		}

		requestAnimationFrame(() => {
			listRef.current?.scrollToEnd?.({ animated: true });
		});
	}, [messages]);

	const selectedConversation = useMemo(
		() => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
		[conversations, selectedConversationId]
	);

	const filteredRecipients = useMemo(() => {
		const query = recipientSearch.trim().toLowerCase();

		if (!query) {
			return recipients;
		}

		return recipients.filter((recipient) => {
			const name = String(recipient?.name || '').toLowerCase();
			const role = String(recipient?.role || '').toLowerCase();
			const email = String(recipient?.email || '').toLowerCase();
			return name.includes(query) || role.includes(query) || email.includes(query);
		});
	}, [recipientSearch, recipients]);

	const messageTimeline = useMemo(() => {
		const timeline = [];
		let previousDate = '';

		for (const message of messages) {
			const key = dateKey(message?.created_at);
			if (key && key !== previousDate) {
				timeline.push({
					type: 'divider',
					id: `divider-${key}`,
					label: formatDateDividerLabel(message?.created_at),
				});
				previousDate = key;
			}

			timeline.push({
				type: 'message',
				id: `message-${message?.id ?? Math.random()}`,
				payload: message,
			});
		}

		return timeline;
	}, [messages]);

	const handleSelectConversation = async (conversationId) => {
		if (!conversationId) {
			return;
		}

		setSelectedConversationId(conversationId);
		await fetchConversationMessages(conversationId);
	};

	const handleSendMessage = async () => {
		const body = draft.trim();

		if (!body || !selectedConversationId || isSendingMessage) {
			return;
		}

		setIsSendingMessage(true);
		setScreenError('');

		try {
			const payload = await sendMessage({
				conversation_id: selectedConversationId,
				body,
			});

			setDraft('');
			setMessages((prev) => [...prev, payload?.data].filter(Boolean));
			await fetchConversations();
		} catch (error) {
			setScreenError(error?.response?.data?.message || 'Unable to send message right now.');
		} finally {
			setIsSendingMessage(false);
		}
	};

	return (
		<ScreenContainer>
			<KeyboardAvoidingView
				style={styles.container}
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 96}
			>
				<View style={styles.headerRow}>
					<View style={styles.headerTitleWrap}>
						<Text style={styles.title}>Messages</Text>
						<Text style={styles.subtitle}>Chat with admin, farm, cafe owner, or reseller.</Text>
					</View>
					<View style={styles.headerActions}>
						<Pressable style={styles.headerIconButton} onPress={() => setRecipientModalOpen(true)}>
							<MaterialIcons name="add-comment" size={18} color="#2D4A1E" />
						</Pressable>
						<Pressable style={styles.headerIconButton} onPress={() => navigation.goBack()}>
							<MaterialIcons name="close" size={20} color="#6E6254" />
						</Pressable>
					</View>
				</View>

				<View style={styles.conversationStripCard}>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.conversationStripContent}>
						{conversations.map((conversation) => {
							const active = conversation.id === selectedConversationId;
							const participant = conversation?.other_participant;
							const unreadCount = Number(conversation?.unread_count || 0);

							return (
								<Pressable
									key={conversation.id}
									style={[styles.conversationPill, active && styles.conversationPillActive]}
									onPress={() => handleSelectConversation(conversation.id)}
								>
									<View style={styles.conversationAvatar}>
										<Text style={styles.conversationAvatarText}>{userInitials(participant?.name)}</Text>
									</View>
									<View style={styles.conversationMeta}>
										<Text numberOfLines={1} style={[styles.conversationName, active && styles.conversationNameActive]}>
											{participant?.name || 'Unknown user'}
										</Text>
										<Text numberOfLines={1} style={styles.conversationPreview}>
											{conversation?.latest_message?.body || 'Tap to open chat'}
										</Text>
									</View>
									{unreadCount > 0 ? (
										<View style={styles.unreadBubble}>
											<Text style={styles.unreadBubbleText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
										</View>
									) : null}
								</Pressable>
							);
						})}
						{!conversations.length ? (
							<View style={styles.noConversationHint}>
								<Text style={styles.noConversationHintText}>No chats yet. Tap + to start a new one.</Text>
							</View>
						) : null}
					</ScrollView>
				</View>

				<View style={styles.threadCard}>
					{isLoadingConversations ? (
						<View style={styles.centeredState}>
							<ActivityIndicator size="large" color="#2D4A1E" />
						</View>
					) : !selectedConversation ? (
						<View style={styles.centeredState}>
							<MaterialIcons name="chat-bubble-outline" size={28} color="#9E8C78" />
							<Text style={styles.emptyThreadText}>Select a conversation to view messages.</Text>
						</View>
					) : (
						<>
							<View style={styles.threadHeader}>
								<View style={styles.threadHeaderAvatar}>
									<Text style={styles.threadHeaderAvatarText}>
										{userInitials(selectedConversation?.other_participant?.name)}
									</Text>
								</View>
								<View style={styles.threadHeaderMeta}>
									<Text style={styles.threadHeaderName}>{selectedConversation?.other_participant?.name || 'Unknown user'}</Text>
									<Text style={styles.threadHeaderRole}>
										{String(selectedConversation?.other_participant?.role || 'user').replace('_', ' ')}
									</Text>
								</View>
							</View>

							{isLoadingMessages ? (
								<View style={styles.centeredState}>
									<ActivityIndicator size="small" color="#2D4A1E" />
								</View>
							) : (
								<FlatList
									ref={listRef}
									data={messageTimeline}
									keyExtractor={(item) => item.id}
									style={styles.messagesList}
									contentContainerStyle={styles.messagesListContent}
									showsVerticalScrollIndicator={false}
									renderItem={({ item }) => {
										if (item.type === 'divider') {
											return (
												<View style={styles.dateDividerRow}>
													<View style={styles.dateDividerLine} />
													<Text style={styles.dateDividerText}>{item.label}</Text>
													<View style={styles.dateDividerLine} />
												</View>
											);
										}

										const message = item.payload;
										const isMine = Number(message?.sender_id) === Number(user?.id);

										return (
											<View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
												<View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
													<Text style={[styles.messageBody, isMine && styles.messageBodyMine]}>{message?.body}</Text>
													<Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>
														{formatMessageTimestamp(message?.created_at)}
													</Text>
												</View>
											</View>
										);
									}}
									ListEmptyComponent={
										<View style={styles.centeredStateSmall}>
											<Text style={styles.emptyThreadText}>No messages yet. Send the first one.</Text>
										</View>
									}
								/>
							)}

							<View style={styles.composerWrap}>
								<TextInput
									style={styles.composerInput}
									value={draft}
									onChangeText={setDraft}
									placeholder="Type a message"
									placeholderTextColor="#9E8C78"
									multiline
								/>
								<Pressable
									style={[styles.sendButton, (!draft.trim() || isSendingMessage) && styles.sendButtonDisabled]}
									onPress={handleSendMessage}
									disabled={!draft.trim() || isSendingMessage}
								>
									{isSendingMessage ? (
										<ActivityIndicator size="small" color="#FFFFFF" />
									) : (
										<MaterialIcons name="send" size={18} color="#FFFFFF" />
									)}
								</Pressable>
							</View>
						</>
					)}
				</View>

				{screenError ? <Text style={styles.errorText}>{screenError}</Text> : null}

				<Modal
					visible={recipientModalOpen}
					transparent
					animationType="slide"
					onRequestClose={() => setRecipientModalOpen(false)}
				>
					<KeyboardAvoidingView
						style={styles.modalKeyboardWrap}
						behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
						keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 36}
					>
						<View style={styles.modalBackdrop}>
							<View style={styles.modalCard}>
								<View style={styles.modalHeader}>
									<Text style={styles.modalTitle}>Start New Chat</Text>
									<Pressable onPress={() => setRecipientModalOpen(false)}>
										<MaterialIcons name="close" size={20} color="#6E6254" />
									</Pressable>
								</View>

								<TextInput
									style={styles.modalSearchInput}
									value={recipientSearch}
									onChangeText={setRecipientSearch}
									placeholder="Search by name, role, or email"
									placeholderTextColor="#9E8C78"
								/>

								<ScrollView
									style={styles.modalList}
									showsVerticalScrollIndicator={false}
									keyboardShouldPersistTaps="handled"
								>
									{filteredRecipients.map((recipient) => (
										<Pressable
											key={recipient.id}
											style={styles.modalRecipientRow}
											onPress={async () => {
												setRecipientModalOpen(false);
												setRecipientSearch('');
												await startConversation(recipient.id);
											}}
											disabled={isPreparingConversation}
										>
											<View style={styles.modalRecipientAvatar}>
												<Text style={styles.modalRecipientAvatarText}>{userInitials(recipient?.name)}</Text>
											</View>
											<View style={styles.modalRecipientMeta}>
												<Text style={styles.modalRecipientName}>{recipient?.name}</Text>
												<Text style={styles.modalRecipientRole}>{String(recipient?.role || '').replace('_', ' ')}</Text>
											</View>
										</Pressable>
									))}

									{!filteredRecipients.length ? (
										<View style={styles.centeredStateSmall}>
											<Text style={styles.emptyThreadText}>No users found.</Text>
										</View>
									) : null}
								</ScrollView>
							</View>
						</View>
					</KeyboardAvoidingView>
				</Modal>
			</KeyboardAvoidingView>
		</ScreenContainer>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		marginBottom: 10,
	},
	headerTitleWrap: {
		flex: 1,
		paddingRight: 12,
	},
	title: {
		fontFamily: 'PoppinsBold',
		fontSize: theme.fontSizes.xl,
		color: theme.colors.sidebar,
	},
	subtitle: {
		marginTop: 2,
		color: '#6E6254',
		fontFamily: 'PoppinsRegular',
		fontSize: 12,
	},
	headerActions: {
		flexDirection: 'row',
		gap: 8,
	},
	headerIconButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: '#D5CABD',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#FFF9F1',
	},
	conversationStripCard: {
		borderWidth: 1,
		borderColor: '#D9CBB5',
		backgroundColor: '#FFF9F1',
		borderRadius: 14,
		paddingVertical: 8,
		marginBottom: 10,
		minHeight: 84,
	},
	conversationStripContent: {
		gap: 8,
		paddingHorizontal: 8,
	},
	conversationPill: {
		width: 210,
		borderWidth: 1,
		borderColor: '#E5D8C6',
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 8,
		backgroundColor: '#FFFFFF',
		flexDirection: 'row',
		alignItems: 'center',
	},
	conversationPillActive: {
		borderColor: '#2D4A1E',
		backgroundColor: '#EEF4ED',
	},
	conversationAvatar: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: '#2D4A1E',
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 8,
	},
	conversationAvatarText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsBold',
		fontSize: 12,
	},
	conversationMeta: {
		flex: 1,
	},
	conversationName: {
		color: '#3A2E22',
		fontFamily: 'PoppinsBold',
		fontSize: 12,
	},
	conversationNameActive: {
		color: '#2D4A1E',
	},
	conversationPreview: {
		color: '#6E6254',
		fontFamily: 'PoppinsRegular',
		fontSize: 11,
		marginTop: 1,
	},
	unreadBubble: {
		minWidth: 18,
		height: 18,
		borderRadius: 999,
		backgroundColor: '#C2410C',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 5,
	},
	unreadBubbleText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsBold',
		fontSize: 10,
		lineHeight: 11,
	},
	noConversationHint: {
		minHeight: 66,
		justifyContent: 'center',
		paddingHorizontal: 8,
	},
	noConversationHintText: {
		color: '#6E6254',
		fontSize: 12,
		fontFamily: 'PoppinsRegular',
	},
	threadCard: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#D9CBB5',
		borderRadius: 16,
		backgroundColor: '#FFF9F1',
		overflow: 'hidden',
	},
	threadHeader: {
		borderBottomWidth: 1,
		borderBottomColor: '#E9DDCF',
		paddingHorizontal: 12,
		paddingVertical: 10,
		flexDirection: 'row',
		alignItems: 'center',
	},
	threadHeaderAvatar: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: '#2D4A1E',
		alignItems: 'center',
		justifyContent: 'center',
	},
	threadHeaderAvatarText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsBold',
		fontSize: 12,
	},
	threadHeaderMeta: {
		marginLeft: 10,
	},
	threadHeaderName: {
		color: '#3A2E22',
		fontFamily: 'PoppinsBold',
		fontSize: 14,
	},
	threadHeaderRole: {
		marginTop: 1,
		color: '#6E6254',
		fontFamily: 'PoppinsRegular',
		fontSize: 11,
		textTransform: 'capitalize',
	},
	messagesList: {
		flex: 1,
	},
	messagesListContent: {
		paddingHorizontal: 10,
		paddingVertical: 10,
		gap: 8,
	},
	dateDividerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 4,
	},
	dateDividerLine: {
		flex: 1,
		height: 1,
		backgroundColor: '#E3D8C8',
	},
	dateDividerText: {
		color: '#8E8071',
		fontFamily: 'PoppinsMedium',
		fontSize: 11,
	},
	messageRow: {
		width: '100%',
	},
	messageRowMine: {
		alignItems: 'flex-end',
	},
	messageRowOther: {
		alignItems: 'flex-start',
	},
	messageBubble: {
		maxWidth: '84%',
		borderRadius: 14,
		paddingHorizontal: 10,
		paddingVertical: 8,
	},
	messageBubbleMine: {
		backgroundColor: '#2D4A1E',
		borderBottomRightRadius: 5,
	},
	messageBubbleOther: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#E4D7C5',
		borderBottomLeftRadius: 5,
	},
	messageBody: {
		fontFamily: 'PoppinsRegular',
		fontSize: 13,
		color: '#3A2E22',
		lineHeight: 18,
	},
	messageBodyMine: {
		color: '#FFFFFF',
	},
	messageTime: {
		marginTop: 4,
		alignSelf: 'flex-end',
		color: '#786C5E',
		fontFamily: 'PoppinsRegular',
		fontSize: 10,
	},
	messageTimeMine: {
		color: 'rgba(255,255,255,0.82)',
	},
	composerWrap: {
		borderTopWidth: 1,
		borderTopColor: '#E9DDCF',
		paddingHorizontal: 10,
		paddingVertical: 8,
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 8,
		backgroundColor: '#FFF9F1',
	},
	composerInput: {
		flex: 1,
		minHeight: 42,
		maxHeight: 110,
		borderWidth: 1,
		borderColor: '#DDCFBC',
		borderRadius: 12,
		backgroundColor: '#FFFFFF',
		color: '#3A2E22',
		fontFamily: 'PoppinsRegular',
		fontSize: 13,
		paddingHorizontal: 12,
		paddingTop: 10,
		paddingBottom: 10,
	},
	sendButton: {
		width: 42,
		height: 42,
		borderRadius: 21,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#2D4A1E',
	},
	sendButtonDisabled: {
		backgroundColor: '#9AA892',
	},
	centeredState: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 20,
	},
	centeredStateSmall: {
		minHeight: 88,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 20,
	},
	emptyThreadText: {
		marginTop: 8,
		color: '#6E6254',
		textAlign: 'center',
		fontFamily: 'PoppinsRegular',
		fontSize: 12,
	},
	errorText: {
		marginTop: 8,
		color: '#B42318',
		fontFamily: 'PoppinsMedium',
		fontSize: 12,
		textAlign: 'center',
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(28, 20, 10, 0.45)',
		justifyContent: 'flex-end',
	},
	modalKeyboardWrap: {
		flex: 1,
	},
	modalCard: {
		maxHeight: '78%',
		backgroundColor: '#FFF9F1',
		borderTopLeftRadius: 18,
		borderTopRightRadius: 18,
		paddingHorizontal: 14,
		paddingTop: 12,
		paddingBottom: 18,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	modalTitle: {
		color: '#3A2E22',
		fontFamily: 'PoppinsBold',
		fontSize: 17,
	},
	modalSearchInput: {
		borderWidth: 1,
		borderColor: '#DDCFBC',
		borderRadius: 10,
		backgroundColor: '#FFFFFF',
		color: '#3A2E22',
		fontFamily: 'PoppinsRegular',
		fontSize: 13,
		paddingHorizontal: 12,
		paddingVertical: 9,
	},
	modalList: {
		marginTop: 10,
	},
	modalRecipientRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#EFE3D2',
	},
	modalRecipientAvatar: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: '#2D4A1E',
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalRecipientAvatarText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsBold',
		fontSize: 11,
	},
	modalRecipientMeta: {
		marginLeft: 10,
		flex: 1,
	},
	modalRecipientName: {
		color: '#3A2E22',
		fontFamily: 'PoppinsMedium',
		fontSize: 13,
	},
	modalRecipientRole: {
		color: '#7D6F61',
		fontFamily: 'PoppinsRegular',
		fontSize: 11,
		marginTop: 1,
		textTransform: 'capitalize',
	},
});

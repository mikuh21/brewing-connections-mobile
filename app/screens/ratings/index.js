import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Image,
	Modal,
	Pressable,
	RefreshControl,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ConfirmToastModal } from '../../components';
import { getRatingsFeed, submitRating } from '../../services';
import { getImageUrl } from '../../utils/imageHelper';

const INITIAL_RATINGS = {
	taste: 0,
	environment: 0,
	cleanliness: 0,
	service: 0,
};
const TRAIL_RESET_SIGNAL_KEY = 'trail_reset_signal_at';
const FEED_TABS = [
	{ id: 'cafe', label: 'Cafes' },
	{ id: 'farm_product', label: 'Farm Products' },
];

function toEstablishmentId(stop) {
	const raw = stop?.establishment_id ?? stop?.id ?? null;
	const asNumber = Number(raw);
	if (Number.isFinite(asNumber) && asNumber > 0) {
		return asNumber;
	}
	return raw;
}

function toStopKey(id) {
	return String(id ?? '');
}

function buildDraft(ratings, photo) {
	return {
		ratings: {
			taste: ratings?.taste ?? 0,
			environment: ratings?.environment ?? 0,
			cleanliness: ratings?.cleanliness ?? 0,
			service: ratings?.service ?? 0,
		},
		photo: photo || null,
	};
}

function toFeedItem(item) {
	const taste = Number(item?.taste_rating ?? item?.taste ?? item?.tasteScore ?? 0) || 0;
	const environment = Number(item?.environment_rating ?? item?.environment ?? item?.environmentScore ?? 0) || 0;
	const cleanliness = Number(item?.cleanliness_rating ?? item?.cleanliness ?? item?.cleanlinessScore ?? 0) || 0;
	const service = Number(item?.service_rating ?? item?.service ?? item?.serviceScore ?? 0) || 0;
	const feedType = item?.feed_type === 'farm_product' || item?.product_id ? 'farm_product' : 'cafe';
	const establishmentName =
		item?.establishment?.name ||
		item?.establishment_name ||
		item?.establishmentName ||
		item?.cafe_name ||
		item?.cafeName ||
		'Unknown Place';
	const productName =
		item?.product?.name ||
		item?.product_name ||
		item?.productName ||
		'Unknown Product';
	const farmName =
		item?.farm_name ||
		item?.product?.establishment?.name ||
		item?.product?.seller?.name ||
		'Unknown Farm';
	const address =
		item?.farm_address ||
		item?.establishment?.address ||
		item?.establishment_address ||
		item?.address ||
		'';
	const barangay =
		item?.farm_barangay ||
		item?.establishment?.barangay ||
		item?.establishment_barangay ||
		item?.barangay ||
		'';
	const locationDisplay = [address, barangay]
		.filter(Boolean)
		.join(', ');
	const userName =
		item?.user?.name ||
		item?.user_name ||
		item?.userName ||
		item?.author_name ||
		'Anonymous';

	return {
		id: item?.id,
		createdAt: item?.created_at || item?.createdAt || item?.timestamp || null,
		feedType,
		title: feedType === 'farm_product' ? productName : establishmentName,
		subtitle: feedType === 'farm_product' ? `Farm: ${farmName}` : establishmentName,
		placeName: establishmentName,
		farmName,
		productName,
		locationDisplay,
		userName,
		taste,
		environment,
		cleanliness,
		service,
		photoUrl: getImageUrl(item?.image_url || item?.photo_url || item?.photo || item?.photo_path || item?.image),
		productImageUrl: getImageUrl(item?.product_image_url || item?.product?.image_url),
	};
}

function timeAgo(dateString) {
	if (!dateString) return '';
	const diff = Date.now() - new Date(dateString).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return 'Just now';
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	const weeks = Math.floor(days / 7);
	if (weeks < 5) return `${weeks}w ago`;
	return `${Math.floor(days / 30)}mo ago`;
}

function ViewModeSwitch({ mode, onChange }) {
	return (
		<View style={styles.modeSwitchWrap}>
			<Pressable
				style={[styles.modeSwitchItem, mode === 'feed' && styles.modeSwitchItemActive]}
				onPress={() => onChange('feed')}
			>
				<Text style={[styles.modeSwitchText, mode === 'feed' && styles.modeSwitchTextActive]}>Community</Text>
			</Pressable>
			<Pressable
				style={[styles.modeSwitchItem, mode === 'form' && styles.modeSwitchItemActive]}
				onPress={() => onChange('form')}
			>
				<Text style={[styles.modeSwitchText, mode === 'form' && styles.modeSwitchTextActive]}>Rate</Text>
			</Pressable>
		</View>
	);
}

const SORT_OPTIONS = [
	{ id: 'newest', label: 'Newest First', icon: 'access-time' },
	{ id: 'highest', label: 'Highest Rated', icon: 'thumb-up' },
	{ id: 'oldest', label: 'Oldest First', icon: 'history' },
];

function RatingsFeedView({ navigation, onSwitchToForm }) {
	const [feedItems, setFeedItems] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(null);
	const [sortBy, setSortBy] = useState('newest');
	const [showSortMenu, setShowSortMenu] = useState(false);
	const [activeFeedTab, setActiveFeedTab] = useState('cafe');
	const [currentPage, setCurrentPage] = useState(0);
	const [confirmState, setConfirmState] = useState({
		visible: false,
		title: '',
		message: '',
		confirmLabel: 'Yes',
		onConfirm: null,
	});

	const openConfirm = ({ title, message, confirmLabel = 'Yes, Confirm', onConfirm }) => {
		setConfirmState({
			visible: true,
			title,
			message,
			confirmLabel,
			onConfirm,
		});
	};

	const closeConfirm = () => {
		setConfirmState((prev) => ({ ...prev, visible: false, onConfirm: null }));
	};

	const handleConfirm = () => {
		const action = confirmState.onConfirm;
		closeConfirm();
		if (typeof action === 'function') {
			action();
		}
	};

	const RATINGS_PER_PAGE = 5;

	const loadFeed = useCallback(async (isRefresh = false) => {
		if (isRefresh) {
			setRefreshing(true);
		} else {
			setIsLoading(true);
		}
		setError(null);
		try {
			const result = await getRatingsFeed();
			const rawItems = Array.isArray(result)
				? result
				: Array.isArray(result?.ratings)
				? result.ratings
				: Array.isArray(result?.results)
				? result.results
				: Array.isArray(result?.data)
				? result.data
				: Array.isArray(result?.data?.ratings)
				? result.data.ratings
				: Array.isArray(result?.data?.items)
				? result.data.items
				: [];
			setFeedItems(rawItems.map(toFeedItem));
		} catch {
			setError('Unable to load the ratings feed.');
		} finally {
			setIsLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		void loadFeed();
	}, [loadFeed]);

	useEffect(() => {
		setCurrentPage(0);
	}, [feedItems, activeFeedTab, sortBy]);

	const filteredFeedItems = useMemo(() => {
		return feedItems.filter((item) => item.feedType === activeFeedTab);
	}, [feedItems, activeFeedTab]);

	const sortedRatings = useMemo(() => {
		const sorted = [...filteredFeedItems];

		if (sortBy === 'highest') {
			sorted.sort((a, b) => {
				const aAvg = (a.taste + a.environment + a.cleanliness + a.service) / 4;
				const bAvg = (b.taste + b.environment + b.cleanliness + b.service) / 4;
				return bAvg - aAvg;
			});
		} else if (sortBy === 'oldest') {
			sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
		} else {
			sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
		}

		return sorted;
	}, [filteredFeedItems, sortBy]);

	const paginatedRatings = useMemo(() => {
		const startIdx = currentPage * RATINGS_PER_PAGE;
		const endIdx = startIdx + RATINGS_PER_PAGE;
		return sortedRatings.slice(startIdx, endIdx);
	}, [sortedRatings, currentPage]);

	const totalPages = Math.ceil(sortedRatings.length / RATINGS_PER_PAGE);
	const selectedSort = SORT_OPTIONS.find(opt => opt.id === sortBy);
	const selectedFeedTab = FEED_TABS.find((tab) => tab.id === activeFeedTab);

	const renderItem = useCallback(({ item }) => {
		const avgRating =
			(item.taste + item.environment + item.cleanliness + item.service) /
			4;
		const roundedAvg = Math.round(avgRating * 10) / 10;

		return (
			<View style={styles.feedCard}>
				{item.photoUrl || item.productImageUrl ? (
					<Image source={{ uri: item.photoUrl || item.productImageUrl }} style={styles.feedCardPhoto} resizeMode="cover" />
				) : null}
				<View style={styles.feedCardBody}>
					<View style={styles.feedCardBadgeRow}>
						<View style={[styles.feedCardBadge, item.feedType === 'farm_product' ? styles.feedCardBadgeFarm : styles.feedCardBadgeCafe]}>
							<Text style={[styles.feedCardBadgeText, item.feedType === 'farm_product' ? styles.feedCardBadgeTextFarm : styles.feedCardBadgeTextCafe]}>
								{item.feedType === 'farm_product' ? 'Farm Product' : 'Cafe'}
							</Text>
						</View>
					</View>
					<View style={styles.feedCardHeaderRow}>
						<Text style={styles.feedCardEstablishment} numberOfLines={2}>
							{item.title}
						</Text>
						<Text style={styles.feedCardTime}>{timeAgo(item.createdAt)}</Text>
					</View>
					<Text style={styles.feedCardSubtitle} numberOfLines={1}>
						{item.feedType === 'farm_product' ? item.subtitle : item.placeName}
					</Text>
					{item.locationDisplay ? (
						<View style={styles.feedCardLocationRow}>
							<MaterialIcons name="location-on" size={14} color="#6B7280" />
							<Text style={styles.feedCardLocation} numberOfLines={1}>
								{item.locationDisplay}
							</Text>
						</View>
					) : null}
					<Text style={styles.feedCardUser}>by {item.userName}</Text>
					<View style={styles.feedCardStarsRow}>
						{[1, 2, 3, 4, 5].map((star) => (
							<MaterialIcons
								key={star}
								name={star <= Math.round(avgRating) ? 'star' : 'star-border'}
								size={16}
								color={star <= Math.round(avgRating) ? '#C8973A' : '#B9AB96'}
							/>
						))}
						<Text style={styles.feedCardAvgText}>{roundedAvg.toFixed(1)}</Text>
					</View>
					<View style={styles.feedCardMetrics}>
						<Text style={styles.feedCardMetricText}>Taste: {item.taste}</Text>
						<Text style={styles.feedCardMetricSep}>·</Text>
						<Text style={styles.feedCardMetricText}>Environment: {item.environment}</Text>
						<Text style={styles.feedCardMetricSep}>·</Text>
						<Text style={styles.feedCardMetricText}>Cleanliness: {item.cleanliness}</Text>
						<Text style={styles.feedCardMetricSep}>·</Text>
						<Text style={styles.feedCardMetricText}>Service: {item.service}</Text>
					</View>
				</View>
			</View>
		);
	}, []);

	return (
		<SafeAreaView style={styles.screen}>
			<FlatList
				data={paginatedRatings}
				keyExtractor={(item, index) => String(`${item.feedType}-${item.id ?? `${item.createdAt ?? 'rating'}-${index}`}`)}
				renderItem={renderItem}
				contentContainerStyle={styles.feedContainer}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void loadFeed(true)}
						tintColor="#2D4A1E"
						colors={['#2D4A1E']}
					/>
				}
				ListHeaderComponent={
					<View>
						<ViewModeSwitch mode="feed" onChange={onSwitchToForm} />
						<Text style={styles.title}>Ratings Feed</Text>
						<Text style={styles.subtitle}>Your recent ratings and from the community</Text>
						<View style={styles.feedTabsWrap}>
							{FEED_TABS.map((tab) => {
								const selected = tab.id === activeFeedTab;
								return (
									<Pressable
										key={tab.id}
										style={[styles.feedTabChip, selected && styles.feedTabChipActive]}
										onPress={() => setActiveFeedTab(tab.id)}
									>
										<Text style={[styles.feedTabChipText, selected && styles.feedTabChipTextActive]}>{tab.label}</Text>
									</Pressable>
								);
							})}
						</View>
						<Pressable
							style={styles.feedActionButton}
							onPress={() => {
								openConfirm({
									title: 'Open Trail',
									message: 'Go to Trail screen to rate another destination?',
									confirmLabel: 'Yes, Open',
									onConfirm: () => navigation.navigate('Trail'),
								});
							}}
						>
							<MaterialIcons name="coffee" size={16} color="#FFFFFF" />
							<Text style={styles.feedActionButtonText}>Rate Another Trail</Text>
						</Pressable>
						<Pressable
							style={styles.sortButton}
							onPress={() => setShowSortMenu(true)}
						>
							<MaterialIcons name="tune" size={18} color="#FFFFFF" />
							<Text style={styles.sortButtonText}>{selectedSort?.label}</Text>
						</Pressable>
					</View>
				}
				ListEmptyComponent={
					isLoading ? (
						<ActivityIndicator size="large" color="#2D4A1E" style={styles.feedLoader} />
					) : error ? (
						<View style={styles.feedEmptyWrap}>
							<MaterialIcons name="error-outline" size={36} color="#B9AB96" />
							<Text style={styles.feedEmptyText}>{error}</Text>
							<Pressable style={styles.feedRetryButton} onPress={() => void loadFeed()}>
								<Text style={styles.feedRetryButtonText}>Retry</Text>
							</Pressable>
						</View>
					) : (
						<View style={styles.feedEmptyWrap}>
							<MaterialIcons name="star-border" size={36} color="#B9AB96" />
							<Text style={styles.feedEmptyText}>
								{selectedFeedTab?.id === 'farm_product'
									? 'No farm product ratings yet. Be the first!'
									: 'No cafe ratings yet. Be the first!'}
							</Text>
						</View>
					)
				}
				ListFooterComponent={
					totalPages > 1 ? (
						<View style={styles.paginationContainer}>
							<Pressable
								style={[
									styles.paginationButton,
									currentPage === 0 && styles.paginationButtonDisabled,
								]}
								onPress={() => setCurrentPage(currentPage - 1)}
								disabled={currentPage === 0}
							>
								<MaterialIcons
									name="chevron-left"
									size={20}
									color={currentPage === 0 ? '#B9AB96' : '#FFFFFF'}
								/>
								<Text
									style={[
										styles.paginationButtonText,
										currentPage === 0 && styles.paginationButtonTextDisabled,
									]}
								>
									Previous
								</Text>
							</Pressable>

							<View style={styles.paginationInfo}>
								<Text style={styles.paginationText}>
									Page {currentPage + 1} of {totalPages}
								</Text>
							</View>

							<Pressable
								style={[
									styles.paginationButton,
									currentPage === totalPages - 1 && styles.paginationButtonDisabled,
								]}
								onPress={() => setCurrentPage(currentPage + 1)}
								disabled={currentPage === totalPages - 1}
							>
								<Text
									style={[
										styles.paginationButtonText,
										currentPage === totalPages - 1 && styles.paginationButtonTextDisabled,
									]}
								>
									Next
								</Text>
								<MaterialIcons
									name="chevron-right"
									size={20}
									color={currentPage === totalPages - 1 ? '#B9AB96' : '#FFFFFF'}
								/>
							</Pressable>
						</View>
					) : null
				}
			/>
			<Modal
				transparent
				visible={showSortMenu}
				animationType="fade"
				onRequestClose={() => setShowSortMenu(false)}
			>
				<Pressable
					style={styles.sortMenuBackdrop}
					onPress={() => setShowSortMenu(false)}
				>
					<View style={styles.sortMenuContainer}>
						<Text style={styles.sortMenuTitle}>Sort By</Text>
						<View style={styles.sortMenuDivider} />
						{SORT_OPTIONS.map(option => (
							<Pressable
								key={option.id}
								style={[
									styles.sortMenuItem,
									sortBy === option.id && styles.sortMenuItemActive,
								]}
								onPress={() => {
									setSortBy(option.id);
									setShowSortMenu(false);
								}}
							>
								<MaterialIcons
									name={option.icon}
									size={20}
									color={sortBy === option.id ? '#2D4A1E' : '#6B7280'}
								/>
								<Text
									style={[
										styles.sortMenuItemText,
										sortBy === option.id && styles.sortMenuItemTextActive,
									]}
								>
									{option.label}
								</Text>
								{sortBy === option.id && (
									<MaterialIcons name="check" size={20} color="#2D4A1E" />
								)}
							</Pressable>
						))}
					</View>
				</Pressable>
			</Modal>
			<ConfirmToastModal
				visible={confirmState.visible}
				title={confirmState.title}
				message={confirmState.message}
				confirmLabel={confirmState.confirmLabel}
				onCancel={closeConfirm}
				onConfirm={handleConfirm}
			/>
		</SafeAreaView>
	);
}

function StarField({ label, value, onChange, disabled = false }) {
	return (
		<View style={styles.metricBlock}>
			<Text style={styles.metricLabel}>{label}</Text>
			<View style={styles.starRow}>
				{[1, 2, 3, 4, 5].map((score) => (
					<Pressable
						key={`${label}-${score}`}
						onPress={() => {
							if (!disabled) {
								onChange(score);
							}
						}}
						disabled={disabled}
						style={[styles.starBtn, disabled && styles.starBtnDisabled]}
					>
						<MaterialIcons
							name={score <= value ? 'star' : 'star-border'}
							size={28}
							color={
								disabled
									? score <= value
										? '#D7CFC4'
										: '#E7E1D6'
									: score <= value
										? '#C8973A'
										: '#B9AB96'
							}
						/>
					</Pressable>
				))}
			</View>
		</View>
	);
}

export default function RatingScreen({ navigation, route }) {
	const trailStops = Array.isArray(route?.params?.trailStops) ? route.params.trailStops : [];
	const hasTrailStops = trailStops.length > 0;

	const normalizedStops = useMemo(
		() =>
			trailStops.map((stop, index) => ({
				id: toEstablishmentId(stop),
				name: stop?.name || `Stop ${index + 1}`,
				type: String(stop?.type || stop?.properties?.type || '').toLowerCase(),
			})),
		[trailStops]
	);

	const cafeStops = useMemo(
		() => normalizedStops.filter((stop) => stop.type === 'cafe'),
		[normalizedStops]
	);

	const [selectedStopId, setSelectedStopId] = useState(cafeStops[0]?.id ?? null);
	const [ratings, setRatings] = useState(INITIAL_RATINGS);
	const [selectedPhoto, setSelectedPhoto] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [ratedStopIds, setRatedStopIds] = useState([]);
	const [draftsByStop, setDraftsByStop] = useState({});
	const [screenView, setScreenView] = useState(hasTrailStops ? 'form' : 'feed');
	const [confirmState, setConfirmState] = useState({
		visible: false,
		title: '',
		message: '',
		confirmLabel: 'Yes',
		onConfirm: null,
	});
	const lastHandledResetSignalRef = useRef('');
	const hasCompleteRatings =
		ratings.taste > 0 &&
		ratings.environment > 0 &&
		ratings.cleanliness > 0 &&
		ratings.service > 0;

	const availableStops = useMemo(
		() =>
			cafeStops.filter((stop) => !ratedStopIds.includes(toStopKey(stop.id))),
		[cafeStops, ratedStopIds]
	);

	const resetFeedbackInputs = useCallback(() => {
		setRatings(INITIAL_RATINGS);
		setSelectedPhoto(null);
	}, []);

	const applyDraftForStop = useCallback(
		(stopId) => {
			const draft = draftsByStop[toStopKey(stopId)];
			setRatings(draft?.ratings || INITIAL_RATINGS);
			setSelectedPhoto(draft?.photo || null);
		},
		[draftsByStop]
	);

	useEffect(() => {
		if (!availableStops.length) {
			setSelectedStopId(null);
			resetFeedbackInputs();
			return;
		}

		const hasSelection = availableStops.some((stop) => toStopKey(stop.id) === toStopKey(selectedStopId));
		if (!hasSelection) {
			const nextStopId = availableStops[0].id;
			setSelectedStopId(nextStopId);
			applyDraftForStop(nextStopId);
		}
	}, [availableStops, selectedStopId, resetFeedbackInputs, applyDraftForStop]);

	useEffect(() => {
		setScreenView(hasTrailStops ? 'form' : 'feed');
	}, [hasTrailStops]);

	const handleSelectStop = (stopId) => {
		if (toStopKey(stopId) === toStopKey(selectedStopId)) {
			return;
		}

		if (selectedStopId !== null && selectedStopId !== undefined) {
			setDraftsByStop((prev) => ({
				...prev,
				[toStopKey(selectedStopId)]: buildDraft(ratings, selectedPhoto),
			}));
		}

		setSelectedStopId(stopId);
		applyDraftForStop(stopId);
	};

	const resetRatingState = useCallback(() => {
		setRatedStopIds([]);
		setDraftsByStop({});
		setSelectedStopId(cafeStops[0]?.id ?? null);
		resetFeedbackInputs();
		navigation?.setParams?.({ trailStops: undefined });
	}, [navigation, cafeStops, resetFeedbackInputs]);

	useFocusEffect(
		useCallback(() => {
			let isActive = true;

			const consumeResetSignal = async () => {
				try {
					const resetSignal = await AsyncStorage.getItem(TRAIL_RESET_SIGNAL_KEY);
					if (!isActive || !resetSignal) {
						return;
					}

					const hasIncomingTrailStops =
						Array.isArray(route?.params?.trailStops) && route.params.trailStops.length > 0;
					if (hasIncomingTrailStops) {
						lastHandledResetSignalRef.current = resetSignal;
						return;
					}

					if (resetSignal === lastHandledResetSignalRef.current) {
						return;
					}

					lastHandledResetSignalRef.current = resetSignal;
					resetRatingState();
				} catch {
					// Keep rating screen usable even if reset-signal read fails.
				}
			};

			void consumeResetSignal();

			return () => {
				isActive = false;
			};
		}, [resetRatingState, route?.params?.trailStops])
	);

	const canSubmit =
		!isSubmitting &&
		selectedStopId !== null &&
		selectedStopId !== undefined &&
		hasCompleteRatings;
	const canRateDestination = selectedStopId !== null && selectedStopId !== undefined;

	const openConfirm = ({ title, message, confirmLabel = 'Yes, Confirm', onConfirm }) => {
		setConfirmState({
			visible: true,
			title,
			message,
			confirmLabel,
			onConfirm,
		});
	};

	const closeConfirm = () => {
		setConfirmState((prev) => ({ ...prev, visible: false, onConfirm: null }));
	};

	const handleConfirm = () => {
		const action = confirmState.onConfirm;
		closeConfirm();
		if (typeof action === 'function') {
			void action();
		}
	};

	const handlePickFromGallery = async () => {
		if (!canRateDestination) {
			return;
		}

		try {
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				quality: 0.8,
			});

			if (result.canceled) {
				return;
			}

			const asset = result.assets?.[0];
			if (asset?.uri) {
				setSelectedPhoto(asset);
				if (selectedStopId !== null && selectedStopId !== undefined) {
					setDraftsByStop((prev) => ({
						...prev,
						[toStopKey(selectedStopId)]: buildDraft(ratings, asset),
					}));
				}
			}
		} catch {
			Alert.alert('Photo upload failed', 'Unable to open your gallery right now.');
		}
	};

	const handleTakePhoto = async () => {
		if (!canRateDestination) {
			return;
		}

		try {
			const permission = await ImagePicker.requestCameraPermissionsAsync();
			if (!permission?.granted) {
				Alert.alert('Camera permission needed', 'Please allow camera access to take a photo.');
				return;
			}

			const result = await ImagePicker.launchCameraAsync({
				allowsEditing: true,
				quality: 0.8,
			});

			if (result.canceled) {
				return;
			}

			const asset = result.assets?.[0];
			if (asset?.uri) {
				setSelectedPhoto(asset);
				if (selectedStopId !== null && selectedStopId !== undefined) {
					setDraftsByStop((prev) => ({
						...prev,
						[toStopKey(selectedStopId)]: buildDraft(ratings, asset),
					}));
				}
			}
		} catch {
			Alert.alert('Photo capture failed', 'Unable to open your camera right now.');
		}
	};

	const handleSubmit = async () => {
		if (!canSubmit) {
			return;
		}

		openConfirm({
			title: 'Confirm Submission',
			message: 'Submit this rating now?',
			confirmLabel: 'Yes, Submit',
			onConfirm: async () => {
					setIsSubmitting(true);
					try {
						const completeRatingFlow = async () => {
							try {
								await AsyncStorage.setItem(TRAIL_RESET_SIGNAL_KEY, String(Date.now()));
							} catch {
								// Do not block completion flow if reset-signal write fails.
							}

							resetRatingState();
							setScreenView('feed');
						};

						const payload = {
							establishment_id: selectedStopId,
							taste_rating: ratings.taste,
							environment_rating: ratings.environment,
							cleanliness_rating: ratings.cleanliness,
							service_rating: ratings.service,
							photo: selectedPhoto?.uri
								? {
									uri: selectedPhoto.uri,
									type: selectedPhoto.mimeType || 'image/jpeg',
									name:
										selectedPhoto.fileName ||
										`rating-${Date.now()}.${
											String(selectedPhoto.mimeType || 'image/jpeg').split('/')[1] || 'jpg'
										}`,
								}
								: undefined,
						};

						await submitRating(payload);

						const ratedStopKey = toStopKey(selectedStopId);
						const remainingStops = availableStops.filter(
							(stop) => toStopKey(stop.id) !== ratedStopKey
						);

						setDraftsByStop((prev) => {
							const next = { ...prev };
							delete next[ratedStopKey];
							return next;
						});
						setRatedStopIds((prev) => (prev.includes(ratedStopKey) ? prev : [...prev, ratedStopKey]));
						const nextStopId = remainingStops[0]?.id ?? null;
						setSelectedStopId(nextStopId);
						if (nextStopId !== null && nextStopId !== undefined) {
							applyDraftForStop(nextStopId);
						} else {
							resetFeedbackInputs();
						}

						if (remainingStops.length) {
							Alert.alert('Thanks for rating!', 'Saved. You can now rate your next destination.');
						} else {
							Alert.alert('All done!', 'You already rated all destinations in this trail.', [
								{
									text: 'Done',
									onPress: () => {
										void completeRatingFlow();
									},
								},
							]);
						}
					} catch (error) {
						const message = error?.response?.data?.message || error?.message || 'Unable to submit rating.';
						Alert.alert('Submission failed', message);
					} finally {
						setIsSubmitting(false);
					}
				},
		});
	};

	if (screenView === 'feed') {
		return <RatingsFeedView navigation={navigation} onSwitchToForm={setScreenView} />;
	}

	return (
		<SafeAreaView style={styles.screen}>
			<ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
				<ViewModeSwitch mode="form" onChange={setScreenView} />
				<Text style={styles.title}>Rate Your Experience</Text>
				<Text style={styles.subtitle}>Share quick feedback about your recent coffee stop</Text>

				<View style={styles.card}>
					<Text style={styles.sectionTitle}>Destination</Text>
					{availableStops.length ? (
						<View style={styles.stopList}>
							{availableStops.map((stop) => {
								const selected = stop.id === selectedStopId;
								return (
									<Pressable
										key={`${stop.id}-${stop.name}`}
										style={[styles.stopChip, selected && styles.stopChipSelected]}
										onPress={() => handleSelectStop(stop.id)}
									>
										<Text style={[styles.stopChipText, selected && styles.stopChipTextSelected]}>
											{stop.name}
										</Text>
									</Pressable>
								);
							})}
						</View>
					) : (
						<Text style={styles.helperText}>
							{hasTrailStops
								? 'No cafe destinations left to rate for this trail.'
								: 'No destination context was provided. Go back and complete a trail to rate a cafe.'}
						</Text>
					)}
				</View>

				<View style={styles.card}>
					<View style={styles.sectionHeaderRow}>
						<Text style={styles.sectionTitle}>Ratings</Text>
						{(ratings.taste > 0 || ratings.environment > 0 || ratings.cleanliness > 0 || ratings.service > 0) ? (
							<Pressable
								style={styles.inlineClearButton}
								onPress={() => {
									openConfirm({
										title: 'Confirm Clear',
										message: 'Clear all current rating values?',
										confirmLabel: 'Yes, Clear',
										onConfirm: () => {
											setRatings(INITIAL_RATINGS);
											if (selectedStopId !== null && selectedStopId !== undefined) {
												setDraftsByStop((prev) => ({
													...prev,
													[toStopKey(selectedStopId)]: buildDraft(INITIAL_RATINGS, selectedPhoto),
												}));
											}
										},
									});
								}}
							>
								<Text style={styles.inlineClearButtonText}>Clear</Text>
							</Pressable>
						) : null}
					</View>
					{!canRateDestination ? (
						<Text style={styles.helperText}>Select a destination first to enable star ratings.</Text>
					) : null}
					<StarField
						label="Taste"
						value={ratings.taste}
						disabled={!canRateDestination}
						onChange={(value) => {
							setRatings((prev) => {
								const nextRatings = { ...prev, taste: value };
								if (selectedStopId !== null && selectedStopId !== undefined) {
									setDraftsByStop((draftPrev) => ({
										...draftPrev,
										[toStopKey(selectedStopId)]: buildDraft(nextRatings, selectedPhoto),
									}));
								}
								return nextRatings;
							});
						}}
					/>
					<StarField
						label="Environment"
						value={ratings.environment}
						disabled={!canRateDestination}
						onChange={(value) => {
							setRatings((prev) => {
								const nextRatings = { ...prev, environment: value };
								if (selectedStopId !== null && selectedStopId !== undefined) {
									setDraftsByStop((draftPrev) => ({
										...draftPrev,
										[toStopKey(selectedStopId)]: buildDraft(nextRatings, selectedPhoto),
									}));
								}
								return nextRatings;
							});
						}}
					/>
					<StarField
						label="Cleanliness"
						value={ratings.cleanliness}
						disabled={!canRateDestination}
						onChange={(value) => {
							setRatings((prev) => {
								const nextRatings = { ...prev, cleanliness: value };
								if (selectedStopId !== null && selectedStopId !== undefined) {
									setDraftsByStop((draftPrev) => ({
										...draftPrev,
										[toStopKey(selectedStopId)]: buildDraft(nextRatings, selectedPhoto),
									}));
								}
								return nextRatings;
							});
						}}
					/>
					<StarField
						label="Service"
						value={ratings.service}
						disabled={!canRateDestination}
						onChange={(value) => {
							setRatings((prev) => {
								const nextRatings = { ...prev, service: value };
								if (selectedStopId !== null && selectedStopId !== undefined) {
									setDraftsByStop((draftPrev) => ({
										...draftPrev,
										[toStopKey(selectedStopId)]: buildDraft(nextRatings, selectedPhoto),
									}));
								}
								return nextRatings;
							});
						}}
					/>
				</View>

				<View style={styles.card}>
					<Text style={styles.sectionTitle}>Photo (Optional)</Text>
					<Text style={styles.helperText}>
						{canRateDestination
							? 'Add a photo from camera or gallery.'
							: 'Select a destination first to enable camera and gallery upload.'}
					</Text>

					<View style={styles.photoActionRow}>
						<Pressable
							style={[styles.photoActionButton, !canRateDestination && styles.photoActionButtonDisabled]}
							onPress={handleTakePhoto}
							disabled={!canRateDestination}
						>
							<MaterialIcons name="photo-camera" size={16} color="#2D4A1E" />
							<Text style={[styles.photoActionButtonText, !canRateDestination && styles.photoActionButtonTextDisabled]}>
								Camera
							</Text>
						</Pressable>
						<Pressable
							style={[styles.photoActionButton, !canRateDestination && styles.photoActionButtonDisabled]}
							onPress={handlePickFromGallery}
							disabled={!canRateDestination}
						>
							<MaterialIcons name="photo-library" size={16} color="#2D4A1E" />
							<Text style={[styles.photoActionButtonText, !canRateDestination && styles.photoActionButtonTextDisabled]}>
								Gallery
							</Text>
						</Pressable>
					</View>

					{selectedPhoto?.uri ? (
						<View style={styles.photoPreviewWrap}>
							<Image source={{ uri: selectedPhoto.uri }} style={styles.photoPreview} />
							<Pressable
								style={styles.removePhotoButton}
								onPress={() => {
									openConfirm({
										title: 'Remove Photo',
										message: 'Remove this selected photo?',
										confirmLabel: 'Yes, Remove',
										onConfirm: () => {
											setSelectedPhoto(null);
											if (selectedStopId !== null && selectedStopId !== undefined) {
												setDraftsByStop((prev) => ({
													...prev,
													[toStopKey(selectedStopId)]: buildDraft(ratings, null),
												}));
											}
										},
									});
								}}
							>
								<MaterialIcons name="close" size={14} color="#FFFFFF" />
							</Pressable>
						</View>
					) : null}
				</View>

				<Pressable
					style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
					onPress={handleSubmit}
					disabled={!canSubmit}
				>
					{isSubmitting ? (
						<ActivityIndicator size="small" color="#FFFFFF" />
					) : (
						<Text style={styles.submitButtonText}>Submit Rating</Text>
					)}
				</Pressable>

				<ConfirmToastModal
					visible={confirmState.visible}
					title={confirmState.title}
					message={confirmState.message}
					confirmLabel={confirmState.confirmLabel}
					onCancel={closeConfirm}
					onConfirm={handleConfirm}
				/>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#F5F0E8',
	},
	container: {
		paddingHorizontal: 16,
		paddingTop: 10,
		paddingBottom: 22,
	},
	title: {
		marginTop: 10,
		color: '#3A2E22',
		fontFamily: 'PoppinsBold',
		fontSize: 24,
		lineHeight: 30,
	},
	subtitle: {
		marginTop: 4,
		color: '#6B7280',
		fontFamily: 'PoppinsRegular',
		fontSize: 13,
		lineHeight: 18,
	},
	card: {
		marginTop: 12,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: '#D7CFC4',
		backgroundColor: '#FFFFFF',
		padding: 12,
	},
	sectionTitle: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsBold',
		fontSize: 15,
		lineHeight: 20,
	},
	sectionHeaderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 10,
	},
	inlineClearButton: {
		borderRadius: 999,
		borderWidth: 1,
		borderColor: '#2D4A1E',
		paddingHorizontal: 10,
		paddingVertical: 4,
		backgroundColor: 'transparent',
	},
	inlineClearButtonText: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsMedium',
		fontSize: 12,
		lineHeight: 15,
	},
	stopList: {
		marginTop: 10,
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	stopChip: {
		borderRadius: 999,
		borderWidth: 1,
		borderColor: '#CDBFAE',
		backgroundColor: '#F7F1E8',
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	stopChipSelected: {
		borderColor: '#2D4A1E',
		backgroundColor: '#2D4A1E',
	},
	stopChipText: {
		color: '#4A3B2D',
		fontFamily: 'PoppinsMedium',
		fontSize: 12,
		lineHeight: 15,
	},
	stopChipTextSelected: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsMedium',
	},
	helperText: {
		marginTop: 8,
		color: '#6B7280',
		fontFamily: 'PoppinsRegular',
		fontSize: 12,
		lineHeight: 17,
	},
	photoActionRow: {
		marginTop: 10,
		flexDirection: 'row',
		gap: 8,
	},
	photoActionButton: {
		flex: 1,
		minHeight: 38,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#2D4A1E',
		backgroundColor: '#F7F1E8',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
	},
	photoActionButtonDisabled: {
		opacity: 0.55,
	},
	photoActionButtonText: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsMedium',
		fontSize: 12,
		lineHeight: 16,
	},
	photoActionButtonTextDisabled: {
		color: '#6B7280',
	},
	photoPreviewWrap: {
		marginTop: 10,
		alignSelf: 'flex-start',
		position: 'relative',
	},
	photoPreview: {
		width: 138,
		height: 138,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#D7CFC4',
		backgroundColor: '#FCFAF7',
	},
	removePhotoButton: {
		position: 'absolute',
		top: 6,
		right: 6,
		width: 22,
		height: 22,
		borderRadius: 999,
		backgroundColor: 'rgba(0, 0, 0, 0.68)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	metricBlock: {
		marginTop: 10,
	},
	metricLabel: {
		color: '#1C1C1C',
		fontFamily: 'PoppinsMedium',
		fontSize: 13,
		lineHeight: 17,
	},
	starRow: {
		marginTop: 6,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 2,
	},
	starBtn: {
		padding: 2,
	},
	starBtnDisabled: {
		opacity: 0.85,
	},
	submitButton: {
		marginTop: 14,
		minHeight: 46,
		borderRadius: 12,
		backgroundColor: '#2D4A1E',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 12,
	},
	submitButtonDisabled: {
		opacity: 0.6,
	},
	submitButtonText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsBold',
		fontSize: 14,
		lineHeight: 18,
	},
	feedContainer: {
		paddingHorizontal: 16,
		paddingTop: 10,
		paddingBottom: 22,
	},
	feedActionButton: {
		marginTop: 12,
		marginBottom: 4,
		minHeight: 44,
		borderRadius: 12,
		backgroundColor: '#2D4A1E',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	feedActionButtonText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsBold',
		fontSize: 14,
		lineHeight: 18,
	},
	feedLoader: {
		marginTop: 40,
	},
	feedEmptyWrap: {
		marginTop: 40,
		alignItems: 'center',
		gap: 8,
	},
	feedEmptyText: {
		color: '#6B7280',
		fontFamily: 'PoppinsRegular',
		fontSize: 14,
		lineHeight: 20,
		textAlign: 'center',
	},
	feedRetryButton: {
		marginTop: 4,
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#2D4A1E',
	},
	feedRetryButtonText: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsMedium',
		fontSize: 13,
		lineHeight: 18,
	},
	feedCard: {
		marginTop: 12,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: '#D7CFC4',
		backgroundColor: '#FFFFFF',
		overflow: 'hidden',
	},
	feedCardPhoto: {
		width: '100%',
		height: 180,
	},
	feedCardBody: {
		padding: 12,
	},
	feedCardBadgeRow: {
		marginBottom: 8,
		flexDirection: 'row',
	},
	feedCardBadge: {
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 5,
	},
	feedCardBadgeCafe: {
		backgroundColor: '#EEF6E6',
	},
	feedCardBadgeFarm: {
		backgroundColor: '#F4EBDD',
	},
	feedCardBadgeText: {
		fontFamily: 'PoppinsBold',
		fontSize: 11,
		lineHeight: 14,
	},
	feedCardBadgeTextCafe: {
		color: '#2D4A1E',
	},
	feedCardBadgeTextFarm: {
		color: '#8A5A20',
	},
	feedCardHeaderRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: 8,
	},
	feedCardEstablishment: {
		flex: 1,
		color: '#2D4A1E',
		fontFamily: 'PoppinsBold',
		fontSize: 15,
		lineHeight: 20,
	},
	feedCardSubtitle: {
		marginTop: 4,
		color: '#3A2E22',
		fontFamily: 'PoppinsMedium',
		fontSize: 13,
		lineHeight: 18,
	},
	feedCardLocationRow: {
		marginTop: 4,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	feedCardLocation: {
		flex: 1,
		color: '#6B7280',
		fontFamily: 'PoppinsRegular',
		fontSize: 12,
		lineHeight: 16,
	},
	feedCardTime: {
		color: '#6B7280',
		fontFamily: 'PoppinsRegular',
		fontSize: 11,
		lineHeight: 16,
		marginTop: 2,
	},
	feedCardUser: {
		marginTop: 2,
		color: '#6B7280',
		fontFamily: 'PoppinsRegular',
		fontSize: 12,
		lineHeight: 16,
	},
	feedCardStarsRow: {
		marginTop: 6,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 2,
	},
	feedCardAvgText: {
		marginLeft: 4,
		color: '#3A2E22',
		fontFamily: 'PoppinsMedium',
		fontSize: 13,
		lineHeight: 16,
	},
	feedCardMetrics: {
		marginTop: 6,
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
		gap: 4,
	},
	feedCardMetricText: {
		color: '#6B7280',
		fontFamily: 'PoppinsRegular',
		fontSize: 11,
		lineHeight: 15,
	},
	feedCardMetricSep: {
		color: '#B9AB96',
		fontSize: 12,
	},
	feedTabsWrap: {
		marginTop: 12,
		flexDirection: 'row',
		gap: 8,
	},
	feedTabChip: {
		flex: 1,
		minHeight: 42,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#D7CFC4',
		backgroundColor: '#FFFFFF',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 12,
	},
	feedTabChipActive: {
		borderColor: '#2D4A1E',
		backgroundColor: '#EEF6E6',
	},
	feedTabChipText: {
		color: '#6B7280',
		fontFamily: 'PoppinsMedium',
		fontSize: 12,
		lineHeight: 16,
		textAlign: 'center',
	},
	feedTabChipTextActive: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsBold',
	},
	modeSwitchWrap: {
		marginTop: 8,
		alignSelf: 'stretch',
		borderRadius: 999,
		padding: 3,
		backgroundColor: '#EDE3D4',
		borderWidth: 1,
		borderColor: '#D7CFC4',
		flexDirection: 'row',
		gap: 4,
	},
	modeSwitchItem: {
		flex: 1,
		minWidth: 0,
		paddingVertical: 6,
		borderRadius: 999,
		alignItems: 'center',
	},
	modeSwitchItemActive: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#D7CFC4',
	},
	modeSwitchText: {
		fontFamily: 'PoppinsMedium',
		fontSize: 12,
		lineHeight: 16,
		color: '#6B7280',
		textAlign: 'center',
	},
	modeSwitchTextActive: {
		color: '#2D4A1E',
	},
	sortButton: {
		marginTop: 12,
		marginBottom: 4,
		minHeight: 44,
		borderRadius: 12,
		backgroundColor: '#2D4A1E',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	sortButtonText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsMedium',
		fontSize: 12,
		lineHeight: 16,
	},
	sortMenuBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'flex-end',
	},
	sortMenuContainer: {
		backgroundColor: '#FFFFFF',
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingHorizontal: 16,
		paddingVertical: 12,
		paddingBottom: 24,
	},
	sortMenuTitle: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsBold',
		fontSize: 16,
		lineHeight: 20,
		marginBottom: 12,
	},
	sortMenuDivider: {
		height: 1,
		backgroundColor: '#D7CFC4',
		marginVertical: 8,
	},
	sortMenuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 12,
		paddingHorizontal: 8,
		borderRadius: 8,
	},
	sortMenuItemActive: {
		backgroundColor: 'rgba(45,74,30,0.08)',
	},
	sortMenuItemText: {
		flex: 1,
		color: '#6B7280',
		fontFamily: 'PoppinsRegular',
		fontSize: 14,
		lineHeight: 18,
	},
	sortMenuItemTextActive: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsMedium',
	},
	paginationContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		marginTop: 20,
		marginBottom: 12,
		paddingHorizontal: 16,
	},
	paginationButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 10,
		backgroundColor: '#2D4A1E',
		minHeight: 40,
		minWidth: 100,
	},
	paginationButtonDisabled: {
		backgroundColor: '#EDE3D4',
	},
	paginationButtonText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsMedium',
		fontSize: 12,
		lineHeight: 16,
	},
	paginationButtonTextDisabled: {
		color: '#B9AB96',
	},
	paginationInfo: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	paginationText: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsMedium',
		fontSize: 13,
		lineHeight: 18,
		textAlign: 'center',
	},
});

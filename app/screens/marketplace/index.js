import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Image,
	Modal,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConfirmToastModal, ScreenContainer } from '../../components';
import { API_CONFIG, getMyOrders, getProducts, placeOrder, updateOrderStatus } from '../../services';
import theme from '../../theme';

const TAB_PRODUCTS = 'products';
const TAB_TRACKING = 'tracking';
const TAB_HISTORY = 'history';
const CART_STORAGE_KEY = 'marketplace_cart_items';

const PRODUCT_TYPE_FILTERS = [
	{ value: 'all', label: 'All' },
	{ value: 'coffee beans', label: 'Coffee Beans' },
	{ value: 'ground coffee', label: 'Ground Coffee' },
	{ value: 'cafe menus', label: 'Cafe Menus' },
];

const ROLE_PILL_THEME = {
	farm: { bg: 'rgba(45, 74, 30, 0.14)', border: 'rgba(45, 74, 30, 0.35)', text: '#2D4A1E', label: 'Farm' },
	cafe: { bg: 'rgba(139, 69, 19, 0.20)', border: 'rgba(139, 69, 19, 0.50)', text: '#6D3408', label: 'Cafe' },
	roaster: { bg: 'rgba(200, 151, 58, 0.18)', border: 'rgba(160, 114, 18, 0.40)', text: '#8A5F0F', label: 'Roaster' },
	reseller: { bg: 'rgba(30, 64, 175, 0.13)', border: 'rgba(30, 64, 175, 0.35)', text: '#1E40AF', label: 'Reseller' },
};

function money(value) {
	return `PHP ${Number(value || 0).toFixed(2)}`;
}

function formatDateValue(date) {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const dd = String(date.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

function formatTimeValue(date) {
	const hh = String(date.getHours()).padStart(2, '0');
	const mm = String(date.getMinutes()).padStart(2, '0');
	return `${hh}:${mm}`;
}

function parseDateValue(value) {
	if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
		const [y, m, d] = String(value).split('-').map(Number);
		return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
	}

	return new Date();
}

function parseTimeValue(value) {
	const date = new Date();
	if (/^\d{2}:\d{2}$/.test(String(value || ''))) {
		const [h, m] = String(value).split(':').map(Number);
		date.setHours(Number.isFinite(h) ? h : 8, Number.isFinite(m) ? m : 0, 0, 0);
	}
	return date;
}

function formatDisplayDate(value) {
	const date = parseDateValue(value);
	return date.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	});
}

function formatDisplayTime(value) {
	const date = parseTimeValue(value);
	return date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

function normalizeSellerRole(product) {
	const rawRole =
		product?.seller_type ||
		product?.seller_role ||
		product?.user_type ||
		product?.seller?.role ||
		product?.seller?.type ||
		'';

	const normalized = String(rawRole).trim().toLowerCase();
	if (normalized.includes('farm')) return 'farm';
	if (normalized.includes('cafe')) return 'cafe';
	if (normalized.includes('roast')) return 'roaster';
	if (normalized.includes('resell')) return 'reseller';
	return null;
}

function resolveImageUrl(pathOrUrl) {
	if (!pathOrUrl) {
		return null;
	}

	const raw = String(pathOrUrl).trim();
	if (!raw) {
		return null;
	}

	const runtimeApiBase = process.env.EXPO_PUBLIC_API_URL || API_CONFIG?.baseUrl;
	const baseUrl = String(runtimeApiBase || '').replace(/\/+$/, '');
	const apiOriginMatch = baseUrl.match(/^(https?:\/\/[^/]+)/i);
	const apiOrigin = apiOriginMatch ? apiOriginMatch[1] : baseUrl;

	if (/^https?:\/\//i.test(raw)) {
		return raw;
	}

	if (!apiOrigin) {
		return raw;
	}

	const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
	if (/^\/storage\//i.test(normalizedPath)) {
		return `${apiOrigin}${normalizedPath}`;
	}

	return `${apiOrigin}/storage/${raw.replace(/^\/+/, '')}`;
}

function orderStatusStyle(status) {
	const normalized = String(status || '').toLowerCase();

	if (normalized === 'confirmed') {
		return { bg: '#E6F4EA', text: '#2E7D32' };
	}

	if (normalized === 'completed') {
		return { bg: '#E3F2FD', text: '#1565C0' };
	}

	if (normalized === 'cancelled' || normalized === 'canceled') {
		return { bg: '#FDECEA', text: '#C62828' };
	}

	return { bg: '#FFF3E0', text: '#B26A00' };
}

export default function MarketplaceScreen() {
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const [activeTab, setActiveTab] = useState(TAB_PRODUCTS);
	const [products, setProducts] = useState([]);
	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState('');
	const [query, setQuery] = useState('');
	const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
	const [reserveModalOpen, setReserveModalOpen] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState(null);
	const [orderQuantity, setOrderQuantity] = useState(1);
	const [pickupDate, setPickupDate] = useState('');
	const [pickupTime, setPickupTime] = useState('');
	const [showNativeDatePicker, setShowNativeDatePicker] = useState(false);
	const [showNativeTimePicker, setShowNativeTimePicker] = useState(false);
	const [modalAction, setModalAction] = useState('order');
	const [cartItems, setCartItems] = useState([]);
	const [submittingOrder, setSubmittingOrder] = useState(false);
	const [cancellingOrderId, setCancellingOrderId] = useState(null);
	const [confirmState, setConfirmState] = useState({
		visible: false,
		title: '',
		message: '',
		confirmLabel: 'Yes',
		onConfirm: null,
	});

	const openConfirm = ({ title, message, confirmLabel = 'Yes', onConfirm }) => {
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

	useEffect(() => {
		const loadCart = async () => {
			try {
				const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
				if (!raw) return;
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					setCartItems(parsed);
				}
			} catch {
				setCartItems([]);
			}
		};

		void loadCart();
	}, []);

	useEffect(() => {
		void AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
	}, [cartItems]);

	const fetchMarketplaceData = async (isRefresh = false) => {
		if (isRefresh) {
			setRefreshing(true);
		} else {
			setLoading(true);
		}

		setError('');

		try {
			const [productsPayload, ordersPayload] = await Promise.all([getProducts(), getMyOrders()]);

			setProducts(Array.isArray(productsPayload?.products) ? productsPayload.products : []);
			setOrders(Array.isArray(ordersPayload?.orders) ? ordersPayload.orders : []);
		} catch (fetchError) {
			const message =
				fetchError?.response?.data?.message ||
				fetchError?.message ||
				'Unable to load marketplace data right now.';

			setError(message);
		} finally {
			if (isRefresh) {
				setRefreshing(false);
			} else {
				setLoading(false);
			}
		}
	};

	useFocusEffect(
		useCallback(() => {
			fetchMarketplaceData(false);
		}, [])
	);

	const filteredProducts = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return products.filter((product) => {
			const productTypeFields = [product?.category, product?.type, product?.product_type]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			if (selectedTypeFilter !== 'all' && !productTypeFields.includes(selectedTypeFilter)) {
				return false;
			}

			if (!normalizedQuery) {
				return true;
			}

			const searchable = [
				product?.name,
				product?.category,
				product?.description,
				product?.seller_name,
				product?.establishment_name,
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			return searchable.includes(normalizedQuery);
		});
	}, [products, query, selectedTypeFilter]);

	const activeOrders = useMemo(
		() =>
			orders.filter((order) => {
				const status = String(order?.status || '').toLowerCase();
				return status !== 'completed' && status !== 'cancelled' && status !== 'canceled';
			}),
		[orders]
	);

	const completedOrders = useMemo(
		() =>
			orders.filter((order) => {
				const status = String(order?.status || '').toLowerCase();
				return status === 'completed' || status === 'cancelled' || status === 'canceled';
			}),
		[orders]
	);

	const openReserveModal = (product, action = 'order') => {
		setSelectedProduct(product);
		setModalAction(action);
		setOrderQuantity(Math.max(1, Number(product?.moq || 1)));
		const now = new Date();
		setPickupDate(formatDateValue(now));
		setPickupTime(formatTimeValue(now));
		setReserveModalOpen(true);
	};

	const closeReserveModal = () => {
		if (submittingOrder) {
			return;
		}

		setReserveModalOpen(false);
		setSelectedProduct(null);
		setShowNativeDatePicker(false);
		setShowNativeTimePicker(false);
	};

	const handleNativeDateChange = (event, selectedDate) => {
		if (event?.type === 'dismissed') {
			setShowNativeDatePicker(false);
			return;
		}

		if (selectedDate) {
			setPickupDate(formatDateValue(selectedDate));
		}

		if (Platform.OS === 'android') {
			setShowNativeDatePicker(false);
		}
	};

	const handleNativeTimeChange = (event, selectedTime) => {
		if (event?.type === 'dismissed') {
			setShowNativeTimePicker(false);
			return;
		}

		if (selectedTime) {
			setPickupTime(formatTimeValue(selectedTime));
		}

		if (Platform.OS === 'android') {
			setShowNativeTimePicker(false);
		}
	};

	const submitOrder = async () => {
		if (!selectedProduct) {
			return;
		}

		const minimumQuantity = Math.max(1, Number(selectedProduct?.moq || 1));
		const quantity = Number(orderQuantity || 0);

		if (!Number.isFinite(quantity) || quantity < minimumQuantity) {
			setError(`Quantity must be at least ${minimumQuantity}.`);
			return;
		}

		if (pickupDate && !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
			setError('Pickup date must use YYYY-MM-DD format.');
			return;
		}

		if (pickupTime && !/^\d{2}:\d{2}$/.test(pickupTime)) {
			setError('Pickup time must use HH:MM format.');
			return;
		}

		openConfirm({
			title: modalAction === 'cart' ? 'Confirm Add to Cart' : 'Confirm Order',
			message: modalAction === 'cart' ? 'Add this item to your cart?' : 'Place this order now?',
			confirmLabel: 'Yes, Confirm',
			onConfirm: async () => {
				const product = selectedProduct;
				const action = modalAction;
				const selectedQuantity = quantity;
				const selectedPickupDate = pickupDate;
				const selectedPickupTime = pickupTime;

				if (!product?.id) {
					return;
				}

				// Close the modal immediately to avoid stacked overlays blocking interaction.
				setReserveModalOpen(false);
				setSelectedProduct(null);
				setShowNativeDatePicker(false);
				setShowNativeTimePicker(false);

				setSubmittingOrder(true);
				setError('');

				if (action === 'cart') {
					const cartEntry = {
						id: `${product.id}-${Date.now()}`,
						product,
						quantity: selectedQuantity,
						pickup_date: selectedPickupDate,
						pickup_time: selectedPickupTime,
						added_at: new Date().toISOString(),
					};

					setCartItems((prev) => [...prev, cartEntry]);
					setSubmittingOrder(false);
					setError('Added to cart.');
					return;
				}

				try {
					await placeOrder({
						product_id: product.id,
						quantity: selectedQuantity,
						pickup_date: selectedPickupDate || null,
						pickup_time: selectedPickupTime || null,
						notes: null,
					});

					setActiveTab(TAB_TRACKING);
					await fetchMarketplaceData(true);
				} catch (submitError) {
					const message =
						submitError?.response?.data?.message ||
						submitError?.message ||
						'Unable to submit order right now.';
					setError(message);
				} finally {
					setSubmittingOrder(false);
				}
			},
		});
	};

	const cancelOrder = async (order) => {
		if (!order?.id) {
			return;
		}

		openConfirm({
			title: 'Confirm Cancel',
			message: 'Cancel this order?',
			confirmLabel: 'Yes, Cancel',
			onConfirm: async () => {
				setCancellingOrderId(order.id);
				setError('');

				try {
					await updateOrderStatus(order.id, 'cancelled');
					await fetchMarketplaceData(true);
				} catch (cancelError) {
					const message =
						cancelError?.response?.data?.message ||
						cancelError?.message ||
						'Unable to cancel order right now.';
					setError(message);
				} finally {
					setCancellingOrderId(null);
				}
			},
		});
	};

	const renderProductCard = ({ item }) => {
		const imageUrl = resolveImageUrl(item?.image_url);
		const stock = Math.max(0, Number(item?.stock_quantity || 0));
		const minimum = Math.max(1, Number(item?.moq || 1));
		const productType = item?.category || item?.type || item?.product_type || null;
		const roastType = item?.roast_type || item?.roast_level || item?.roast || null;
		const grindType = item?.grind_type || item?.grind || null;
		const sellerRole = normalizeSellerRole(item);
		const sellerRoleTheme = sellerRole ? ROLE_PILL_THEME[sellerRole] : null;

		return (
			<View style={styles.productCard}>
				{imageUrl ? (
					<Image source={{ uri: imageUrl }} style={styles.productImage} />
				) : (
					<View style={[styles.productImage, styles.productImagePlaceholder]}>
						<MaterialIcons name="image-not-supported" size={22} color={theme.colors.textMuted} />
					</View>
				)}

				<View style={styles.productBody}>
					<Text style={styles.productName}>{item?.name || 'Product'}</Text>
					<Text style={styles.productMeta}>
						{(item?.seller_name || 'Seller')}
						{item?.establishment_name ? ` • ${item.establishment_name}` : ''}
					</Text>

					{sellerRoleTheme ? (
						<View
							style={[
								styles.rolePill,
								{ backgroundColor: sellerRoleTheme.bg, borderColor: sellerRoleTheme.border },
							]}
						>
							<Text style={[styles.rolePillText, { color: sellerRoleTheme.text }]}>{sellerRoleTheme.label}</Text>
						</View>
					) : null}

					{productType || roastType || grindType ? (
						<Text style={styles.productRoastGrind}>
							{productType ? `${productType}` : ''}
							{productType && (roastType || grindType) ? ' • ' : ''}
							{roastType ? `Roast: ${roastType}` : ''}
							{roastType && grindType ? ' • ' : ''}
							{grindType ? `Grind: ${grindType}` : ''}
						</Text>
					) : null}

					<Text numberOfLines={2} style={styles.productDescription}>
						{item?.description || 'No description available.'}
					</Text>

					<View style={styles.productInfoRow}>
						<Text style={styles.productPrice}>{money(item?.price_per_unit)}</Text>
						<Text style={styles.productStock}>Stock: {stock}</Text>
					</View>

					<Text style={styles.productHint}>MOQ: {minimum} {item?.unit || 'kg'}</Text>

					<View style={styles.productActionsRow}>
						<Pressable style={styles.reserveButton} onPress={() => openReserveModal(item, 'order')}>
							<MaterialIcons name="bolt" size={16} color={theme.colors.white} />
							<Text style={styles.reserveButtonText}>Order Now</Text>
						</Pressable>
						<Pressable style={styles.addToCartButton} onPress={() => openReserveModal(item, 'cart')}>
							<MaterialIcons name="add-shopping-cart" size={16} color={theme.colors.primary} />
							<Text style={styles.addToCartButtonText}>Add to Cart</Text>
						</Pressable>
					</View>
				</View>
			</View>
		);
	};

	const renderOrderCard = ({ item }) => {
		const status = String(item?.status || 'pending');
		const normalizedStatus = status.toLowerCase();
		const statusStyle = orderStatusStyle(status);
		const imageUrl = resolveImageUrl(item?.product?.image_url);
		const cancellable = activeTab === TAB_TRACKING && (normalizedStatus === 'pending' || normalizedStatus === 'confirmed');

		return (
			<View style={styles.orderCard}>
				<View style={styles.orderHeaderRow}>
					<Text style={styles.orderId}>Order #{item?.id}</Text>
					<View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
						<Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{status}</Text>
					</View>
				</View>

				<View style={styles.orderBodyRow}>
					{imageUrl ? (
						<Image source={{ uri: imageUrl }} style={styles.orderImage} />
					) : (
						<View style={[styles.orderImage, styles.productImagePlaceholder]}>
							<MaterialIcons name="inventory-2" size={18} color={theme.colors.textMuted} />
						</View>
					)}

					<View style={styles.orderBodyTextWrap}>
						<Text style={styles.orderProductName}>{item?.product?.name || 'Product'}</Text>
						<Text style={styles.orderDetail}>Qty: {item?.quantity || 0}</Text>
						<Text style={styles.orderDetail}>Total: {money(item?.total_price)}</Text>
						<Text style={styles.orderDetail}>
							Pickup: {item?.pickup_date || 'Not set'} {item?.pickup_time || ''}
						</Text>
						<Pressable style={styles.chatSellerButton} onPress={() => {}}>
							<MaterialIcons name="chat-bubble-outline" size={14} color={theme.colors.primary} />
							<Text style={styles.chatSellerButtonText}>Chat with seller</Text>
						</Pressable>

						{cancellable ? (
							<Pressable
								style={styles.cancelOrderButton}
								onPress={() => cancelOrder(item)}
								disabled={cancellingOrderId === item.id}
							>
								<Text style={styles.cancelOrderButtonText}>
									{cancellingOrderId === item.id ? 'Cancelling...' : 'Cancel Order'}
								</Text>
							</Pressable>
						) : null}
					</View>
				</View>
			</View>
		);
	};

	const activeList = activeTab === TAB_PRODUCTS ? filteredProducts : activeTab === TAB_TRACKING ? activeOrders : completedOrders;
	const isProductsEmpty = activeTab === TAB_PRODUCTS && !loading && activeList.length === 0;
	const listBottomSpacing = Math.max(36, insets.bottom + 84);

	return (
		<ScreenContainer>
			<View style={styles.headerWrap}>
				<View style={styles.headerRow}>
					<Text style={styles.title}>Marketplace</Text>
					<Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
						<MaterialIcons name="arrow-back" size={16} color={theme.colors.white} />
						<Text style={styles.backButtonText}>Back</Text>
					</Pressable>
				</View>
				<Text style={styles.subtitle}>Order fresh coffee products and track your orders</Text>
			</View>

			<View style={styles.tabRow}>
				<Pressable
					style={[styles.tabButton, activeTab === TAB_PRODUCTS && styles.tabButtonActive]}
					onPress={() => setActiveTab(TAB_PRODUCTS)}
				>
					<Text style={[styles.tabButtonText, activeTab === TAB_PRODUCTS && styles.tabButtonTextActive]}>Products</Text>
				</Pressable>

				<Pressable
					style={[styles.tabButton, activeTab === TAB_TRACKING && styles.tabButtonActive]}
					onPress={() => setActiveTab(TAB_TRACKING)}
				>
					<Text style={[styles.tabButtonText, activeTab === TAB_TRACKING && styles.tabButtonTextActive]}>Tracking</Text>
				</Pressable>

				<Pressable
					style={[styles.tabButton, activeTab === TAB_HISTORY && styles.tabButtonActive]}
					onPress={() => setActiveTab(TAB_HISTORY)}
				>
					<Text style={[styles.tabButtonText, activeTab === TAB_HISTORY && styles.tabButtonTextActive]}>History</Text>
				</Pressable>
			</View>

			{activeTab === TAB_PRODUCTS ? (
				<>
					<View style={styles.searchWrap}>
						<MaterialIcons name="search" size={18} color={theme.colors.textMuted} />
						<TextInput
							value={query}
							onChangeText={setQuery}
							placeholder="Search products, category, seller"
							placeholderTextColor={theme.colors.textMuted}
							style={styles.searchInput}
						/>
					</View>
					<View style={styles.filterWrap}>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							style={styles.filterScroll}
							contentContainerStyle={styles.filterRow}
						>
							{PRODUCT_TYPE_FILTERS.map((filter) => {
								const active = selectedTypeFilter === filter.value;
								return (
									<Pressable
										key={filter.value}
										style={[styles.filterChip, active && styles.filterChipActive]}
										onPress={() => setSelectedTypeFilter(filter.value)}
									>
										<Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
									</Pressable>
								);
							})}
						</ScrollView>
					</View>
				</>
			) : null}

			{error ? <Text style={styles.errorText}>{error}</Text> : null}

			{loading ? (
				<View style={styles.loaderWrap}>
					<ActivityIndicator size="large" color={theme.colors.primary} />
					<Text style={styles.loaderText}>Loading marketplace...</Text>
				</View>
			) : (
				<FlatList
					data={activeList}
					keyExtractor={(item) => String(item?.id || Math.random())}
					renderItem={activeTab === TAB_PRODUCTS ? renderProductCard : renderOrderCard}
					removeClippedSubviews={false}
					style={styles.list}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMarketplaceData(true)} tintColor={theme.colors.primary} />}
					contentContainerStyle={[
						styles.listContent,
						{ paddingBottom: listBottomSpacing },
						isProductsEmpty && styles.listContentProductsEmpty,
					]}
					showsVerticalScrollIndicator={false}
					ListEmptyComponent={
						<View style={[styles.emptyStateWrap, isProductsEmpty && styles.emptyStateWrapProductsEmpty]}>
							<MaterialIcons name="inventory" size={24} color={theme.colors.textMuted} />
							<Text style={styles.emptyStateText}>
								{activeTab === TAB_PRODUCTS
									? 'No products available right now.'
									: activeTab === TAB_TRACKING
										? 'No active orders yet.'
										: 'No completed/cancelled orders yet.'}
							</Text>
						</View>
					}
				/>
			)}

			<Modal visible={reserveModalOpen} transparent animationType="fade" onRequestClose={closeReserveModal}>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>{modalAction === 'cart' ? 'Add to Cart' : 'Order Product'}</Text>

						<Text style={styles.modalProductName}>{selectedProduct?.name || ''}</Text>
						<Text style={styles.modalDetail}>{money(selectedProduct?.price_per_unit)} / {selectedProduct?.unit || 'kg'}</Text>
						<Text style={styles.modalDetail}>Minimum order: {Math.max(1, Number(selectedProduct?.moq || 1))}</Text>

						<View style={styles.modalFieldWrap}>
							<Text style={styles.modalLabel}>Quantity</Text>
							<TextInput
								value={String(orderQuantity)}
								onChangeText={(value) => setOrderQuantity(Number(value.replace(/[^0-9]/g, '') || 0))}
								keyboardType="number-pad"
								style={styles.modalInput}
							/>
						</View>

						<View style={styles.modalFieldWrap}>
							<Text style={styles.modalLabel}>Pickup Date</Text>
							<Pressable style={styles.pickerTrigger} onPress={() => setShowNativeDatePicker(true)}>
								<MaterialIcons name="calendar-today" size={16} color={theme.colors.primary} />
								<Text style={styles.pickerTriggerText}>{pickupDate ? formatDisplayDate(pickupDate) : 'Select date'}</Text>
							</Pressable>
							{showNativeDatePicker ? (
								<DateTimePicker
									value={parseDateValue(pickupDate)}
									mode="date"
									display={Platform.OS === 'ios' ? 'compact' : 'default'}
									onChange={handleNativeDateChange}
								/>
							) : null}
						</View>

						<View style={styles.modalFieldWrap}>
							<Text style={styles.modalLabel}>Estimated Pickup Time</Text>
							<Pressable style={styles.pickerTrigger} onPress={() => setShowNativeTimePicker(true)}>
								<MaterialIcons name="access-time" size={16} color={theme.colors.primary} />
								<Text style={styles.pickerTriggerText}>{pickupTime ? formatDisplayTime(pickupTime) : 'Select time'}</Text>
							</Pressable>
							{showNativeTimePicker ? (
								<DateTimePicker
									value={parseTimeValue(pickupTime)}
									mode="time"
									is24Hour
									display={Platform.OS === 'ios' ? 'compact' : 'default'}
									onChange={handleNativeTimeChange}
								/>
							) : null}
						</View>

						<View style={styles.modalFieldWrap}>
							<Text style={styles.modalLabel}>Chat with seller</Text>
							<Pressable style={styles.chatSellerButtonModal} onPress={() => {}}>
								<MaterialIcons name="chat" size={16} color={theme.colors.white} />
								<Text style={styles.chatSellerButtonModalText}>Open Chat</Text>
							</Pressable>
						</View>

						<View style={styles.modalActionsRow}>
							<Pressable style={styles.modalCancelButton} onPress={closeReserveModal}>
								<Text style={styles.modalCancelText}>Cancel</Text>
							</Pressable>

							<Pressable style={styles.modalSubmitButton} onPress={submitOrder} disabled={submittingOrder}>
								<Text style={styles.modalSubmitText}>
									{submittingOrder
										? modalAction === 'cart'
											? 'Adding...'
											: 'Ordering...'
										: modalAction === 'cart'
											? 'Add to Cart'
											: 'Order Now'}
								</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>

			<Pressable
				style={[styles.floatingCartButton, { bottom: Math.max(insets.bottom + 18, 26) }]}
				onPress={() => navigation.navigate('MarketplaceCart')}
			>
				<MaterialIcons name="shopping-cart" size={22} color={theme.colors.white} />
				{cartItems.length > 0 ? (
					<View style={styles.floatingCartBadge}>
						<Text style={styles.floatingCartBadgeText}>{cartItems.length}</Text>
					</View>
				) : null}
			</Pressable>

			<ConfirmToastModal
				visible={confirmState.visible}
				title={confirmState.title}
				message={confirmState.message}
				confirmLabel={confirmState.confirmLabel}
				onCancel={closeConfirm}
				onConfirm={handleConfirm}
			/>
		</ScreenContainer>
	);
}

const styles = StyleSheet.create({
	headerWrap: {
		marginBottom: theme.spacing.md,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	title: {
		fontSize: theme.fontSizes.xl,
		fontWeight: '700',
		color: theme.colors.sidebar,
		fontFamily: 'PoppinsBold',
	},
	backButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: theme.borderRadius.pill,
		backgroundColor: theme.colors.primary,
	},
	backButtonText: {
		color: theme.colors.white,
		fontFamily: 'PoppinsMedium',
		fontSize: theme.fontSizes.sm,
	},
	subtitle: {
		marginTop: 4,
		color: theme.colors.textMuted,
		fontSize: theme.fontSizes.sm,
		fontFamily: 'PoppinsRegular',
	},
	tabRow: {
		flexDirection: 'row',
		marginBottom: theme.spacing.md,
		backgroundColor: '#EDE3D4',
		borderRadius: theme.borderRadius.pill,
		padding: 3,
		borderWidth: 1,
		borderColor: '#D7CFC4',
		gap: 4,
	},
	tabButton: {
		flex: 1,
		borderRadius: theme.borderRadius.pill,
		paddingVertical: 6,
		alignItems: 'center',
	},
	tabButtonActive: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#D7CFC4',
	},
	tabButtonText: {
		color: '#6B7280',
		fontSize: 12,
		lineHeight: 16,
		fontFamily: 'PoppinsMedium',
		textAlign: 'center',
	},
	tabButtonTextActive: {
		color: '#2D4A1E',
	},
	searchWrap: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: theme.colors.white,
		borderColor: theme.colors.border,
		borderWidth: 1,
		borderRadius: theme.borderRadius.md,
		paddingHorizontal: 12,
		marginBottom: theme.spacing.md,
	},
	searchInput: {
		flex: 1,
		marginLeft: 8,
		color: theme.colors.sidebar,
		paddingVertical: 10,
		fontFamily: theme.fonts.body,
	},
	filterRow: {
		paddingBottom: 0,
		paddingTop: 0,
		paddingRight: 6,
		paddingLeft: 2,
		alignItems: 'center',
	},
	filterWrap: {
		minHeight: 34,
		justifyContent: 'center',
		marginBottom: 8,
		position: 'relative',
		zIndex: 2,
	},
	filterScroll: {
		maxHeight: 34,
	},
	filterChip: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#D7CFC4',
		backgroundColor: '#F7F1E8',
		minHeight: 26,
		justifyContent: 'center',
		alignItems: 'center',
		flexShrink: 0,
		marginRight: 8,
	},
	filterChipActive: {
		backgroundColor: '#2D4A1E',
		borderColor: '#2D4A1E',
	},
	filterChipText: {
		fontFamily: 'PoppinsMedium',
		fontSize: 11,
		lineHeight: 14,
		color: '#6B7280',
	},
	filterChipTextActive: {
		color: '#FFFFFF',
	},
	loaderWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: theme.spacing.xl,
	},
	loaderText: {
		marginTop: 10,
		color: theme.colors.textMuted,
		fontFamily: theme.fonts.body,
	},
	list: {
		backgroundColor: 'transparent',
		marginTop: 0,
	},
	listContent: {
		paddingTop: 8,
	},
	listContentProductsEmpty: {
		paddingTop: 0,
	},
	productCard: {
		backgroundColor: theme.colors.white,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.borderRadius.lg,
		marginBottom: theme.spacing.md,
		overflow: 'hidden',
		...theme.shadows.sm,
	},
	productImage: {
		width: '100%',
		height: 150,
		backgroundColor: '#EFE6D7',
	},
	productImagePlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	productBody: {
		padding: theme.spacing.md,
	},
	productName: {
		fontSize: theme.fontSizes.lg,
		color: theme.colors.sidebar,
		fontFamily: 'PoppinsBold',
		fontWeight: '700',
	},
	productMeta: {
		marginTop: 2,
		color: theme.colors.textMuted,
		fontSize: theme.fontSizes.sm,
		fontFamily: 'PoppinsRegular',
	},
	rolePill: {
		alignSelf: 'flex-start',
		marginTop: 6,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: theme.borderRadius.pill,
		borderWidth: 1,
	},
	rolePillText: {
		fontFamily: 'PoppinsMedium',
		fontSize: 11,
		lineHeight: 14,
	},
	productRoastGrind: {
		marginTop: 4,
		color: '#6B5B4A',
		fontSize: theme.fontSizes.xs,
		fontFamily: 'PoppinsMedium',
	},
	productDescription: {
		marginTop: 8,
		color: '#6B5B4A',
		fontSize: theme.fontSizes.sm,
		lineHeight: 20,
		fontFamily: theme.fonts.body,
	},
	productInfoRow: {
		marginTop: 10,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	productPrice: {
		color: theme.colors.primary,
		fontWeight: '700',
		fontSize: theme.fontSizes.md,
		fontFamily: theme.fonts.body,
	},
	productStock: {
		color: theme.colors.textMuted,
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	productHint: {
		marginTop: 4,
		color: '#826D54',
		fontSize: theme.fontSizes.xs,
		fontFamily: theme.fonts.body,
	},
	productActionsRow: {
		marginTop: 12,
		flexDirection: 'row',
		gap: 8,
	},
	reserveButton: {
		flex: 1,
		backgroundColor: theme.colors.primary,
		borderRadius: theme.borderRadius.md,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 10,
		gap: 6,
	},
	addToCartButton: {
		flex: 1,
		borderRadius: theme.borderRadius.md,
		borderWidth: 1,
		borderColor: theme.colors.primary,
		backgroundColor: '#EEF4E8',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 10,
		gap: 6,
	},
	reserveButtonText: {
		color: theme.colors.white,
		fontWeight: '700',
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	addToCartButtonText: {
		color: theme.colors.primary,
		fontWeight: '700',
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	orderCard: {
		backgroundColor: theme.colors.white,
		borderRadius: theme.borderRadius.md,
		borderWidth: 1,
		borderColor: theme.colors.border,
		marginBottom: theme.spacing.md,
		padding: theme.spacing.md,
	},
	orderHeaderRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	orderId: {
		color: theme.colors.sidebar,
		fontWeight: '700',
		fontFamily: theme.fonts.body,
	},
	statusBadge: {
		borderRadius: theme.borderRadius.pill,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	statusBadgeText: {
		fontSize: theme.fontSizes.xs,
		fontWeight: '700',
		textTransform: 'capitalize',
		fontFamily: theme.fonts.body,
	},
	orderBodyRow: {
		flexDirection: 'row',
		gap: 10,
	},
	orderImage: {
		width: 68,
		height: 68,
		borderRadius: theme.borderRadius.sm,
		backgroundColor: '#EFE6D7',
	},
	orderBodyTextWrap: {
		flex: 1,
	},
	orderProductName: {
		color: theme.colors.sidebar,
		fontWeight: '700',
		fontFamily: 'PoppinsBold',
	},
	orderDetail: {
		marginTop: 2,
		color: theme.colors.textMuted,
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	chatSellerButton: {
		marginTop: 8,
		alignSelf: 'flex-start',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: theme.borderRadius.pill,
		borderWidth: 1,
		borderColor: '#2D4A1E',
		backgroundColor: '#EEF4E8',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	chatSellerButtonText: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsMedium',
		fontSize: theme.fontSizes.xs,
	},
	errorText: {
		marginBottom: theme.spacing.sm,
		color: '#B00020',
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	emptyStateWrap: {
		alignItems: 'center',
		justifyContent: 'flex-start',
		paddingVertical: theme.spacing.lg,
		gap: 10,
	},
	emptyStateWrapProductsEmpty: {
		paddingTop: 10,
		paddingBottom: 8,
	},
	emptyStateText: {
		color: theme.colors.textMuted,
		fontSize: theme.fontSizes.sm,
		textAlign: 'center',
		fontFamily: theme.fonts.body,
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.35)',
		justifyContent: 'center',
		paddingHorizontal: theme.spacing.md,
	},
	modalCard: {
		backgroundColor: theme.colors.white,
		borderRadius: theme.borderRadius.lg,
		padding: theme.spacing.md,
	},
	modalTitle: {
		color: theme.colors.sidebar,
		fontSize: theme.fontSizes.lg,
		fontWeight: '700',
		fontFamily: 'PoppinsBold',
	},
	modalProductName: {
		marginTop: 8,
		color: theme.colors.sidebar,
		fontWeight: '700',
		fontFamily: 'PoppinsBold',
	},
	modalDetail: {
		marginTop: 2,
		color: theme.colors.textMuted,
		fontFamily: theme.fonts.body,
	},
	modalFieldWrap: {
		marginTop: 10,
	},
	modalLabel: {
		color: theme.colors.sidebar,
		fontSize: theme.fontSizes.sm,
		marginBottom: 4,
		fontFamily: theme.fonts.body,
		fontWeight: '600',
	},
	modalInput: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.borderRadius.sm,
		paddingHorizontal: 10,
		paddingVertical: 8,
		color: theme.colors.sidebar,
		fontFamily: theme.fonts.body,
		backgroundColor: '#FCFAF7',
	},
	chatSellerButtonModal: {
		borderRadius: theme.borderRadius.md,
		backgroundColor: theme.colors.primary,
		paddingVertical: 10,
		paddingHorizontal: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	chatSellerButtonModalText: {
		color: theme.colors.white,
		fontFamily: 'PoppinsBold',
		fontSize: theme.fontSizes.sm,
	},
	pickerTrigger: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.borderRadius.sm,
		paddingHorizontal: 10,
		paddingVertical: 10,
		backgroundColor: '#FCFAF7',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	pickerTriggerText: {
		color: theme.colors.sidebar,
		fontFamily: 'PoppinsRegular',
		fontSize: theme.fontSizes.sm,
	},
	cancelOrderButton: {
		marginTop: 8,
		alignSelf: 'flex-start',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: theme.borderRadius.pill,
		borderWidth: 1,
		borderColor: '#E57373',
		backgroundColor: '#FFF5F5',
	},
	cancelOrderButtonText: {
		color: '#C62828',
		fontWeight: '700',
		fontSize: theme.fontSizes.xs,
		fontFamily: theme.fonts.body,
	},
	modalActionsRow: {
		marginTop: 14,
		flexDirection: 'row',
		gap: 10,
	},
	modalCancelButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.borderRadius.md,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 10,
	},
	modalCancelText: {
		color: theme.colors.sidebar,
		fontWeight: '600',
		fontFamily: theme.fonts.body,
	},
	modalSubmitButton: {
		flex: 1,
		backgroundColor: theme.colors.primary,
		borderRadius: theme.borderRadius.md,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 10,
	},
	modalSubmitText: {
		color: theme.colors.white,
		fontWeight: '700',
		fontFamily: theme.fonts.body,
	},
	floatingCartButton: {
		position: 'absolute',
		right: theme.spacing.md,
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: theme.colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		...theme.shadows.sm,
		zIndex: 20,
	},
	floatingCartBadge: {
		position: 'absolute',
		top: -3,
		right: -3,
		minWidth: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: '#C62828',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 4,
	},
	floatingCartBadgeText: {
		color: '#FFFFFF',
		fontSize: 11,
		fontFamily: 'PoppinsBold',
	},
});

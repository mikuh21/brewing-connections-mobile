import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Image,
	Linking,
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
import {
	API_CONFIG,
	createLandingReservationPrefillToken,
	getMyOrders,
	getProducts,
	placeOrder,
	updateOrderStatus,
} from '../../services';
import { useAuth } from '../../context';
import theme from '../../theme';

const TAB_PRODUCTS = 'products';
const TAB_TRACKING = 'tracking';
const TAB_HISTORY = 'history';
const CART_STORAGE_KEY = 'marketplace_cart_items';
const MARKETPLACE_ACTION_GREEN = '#2D4A1E';

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

function getPrimarySellerName(source) {
	return normalizeBusinessName(
		source?.seller_name ||
			source?.product?.seller_name ||
			source?.seller?.name ||
			source?.product?.seller?.name ||
			source?.establishment_name ||
			source?.product?.establishment_name ||
			''
	);
}

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

function formatDisplayDateTime(dateValue, timeValue) {
	if (!dateValue) {
		return 'Not set';
	}

	const dateText = formatDisplayDate(dateValue);
	if (!timeValue) {
		return dateText;
	}

	return `${dateText} | ${formatDisplayTime(timeValue)}`;
}

function normalizeBusinessName(name) {
	return String(name || '').replace(/Cafe and Restaurant/gi, 'Cafe & Restaurant').trim();
}

function buildLandingReservationUrl({ productId, quantity, prefillToken }) {
	const runtimeWebBase = process.env.EXPO_PUBLIC_WEB_URL || API_CONFIG?.baseUrl || '';
	const baseUrl = String(runtimeWebBase || '').replace(/\/+$/, '');
	if (!baseUrl) {
		return '';
	}

	const params = new URLSearchParams();
	if (Number.isInteger(Number(productId)) && Number(productId) > 0) {
		params.set('product_id', String(Number(productId)));
	}
	if (Number.isFinite(Number(quantity)) && Number(quantity) > 0) {
		params.set('quantity', String(Math.floor(Number(quantity))));
	}
	if (prefillToken) {
		params.set('prefill_token', String(prefillToken));
	}

	const query = params.toString();
	return `${baseUrl}/${query ? `?${query}` : ''}#farm-products`;
}

function getSellerDisplayName(source) {
	const sellerName = normalizeBusinessName(
		source?.seller_name ||
			source?.product?.seller_name ||
			source?.seller?.name ||
			source?.product?.seller?.name ||
			'Seller'
	);

	const establishmentName = normalizeBusinessName(
		source?.establishment_name ||
			source?.product?.establishment_name ||
			source?.establishment?.name ||
			source?.product?.establishment?.name ||
			''
	);

	const role = String(
		source?.seller_type ||
			source?.seller_role ||
			source?.user_type ||
			source?.product?.seller_type ||
			source?.product?.seller_role ||
			source?.product?.user_type ||
			source?.seller?.role ||
			source?.seller?.type ||
			source?.product?.seller?.role ||
			source?.product?.seller?.type ||
			''
	)
		.trim()
		.toLowerCase();

	if (role.includes('cafe')) {
		return sellerName || establishmentName || 'Seller';
	}

	if (establishmentName && establishmentName !== sellerName) {
		return `${sellerName} | ${establishmentName}`;
	}

	return sellerName || 'Seller';
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

function getSellerRecipientId(source) {
	const possibleIds = [
		source?.seller_user_id,
		source?.seller_id,
		source?.owner_id,
		source?.user_id,
		source?.seller?.seller_user_id,
		source?.seller?.user_id,
		source?.owner?.id,
		source?.seller?.id,
		source?.product?.seller_user_id,
		source?.product?.seller_id,
		source?.product?.owner_id,
		source?.product?.user_id,
		source?.product?.seller?.seller_user_id,
		source?.product?.seller?.user_id,
		source?.product?.owner?.id,
		source?.product?.seller?.id,
	];

	for (const candidate of possibleIds) {
		const numeric = Number(candidate);
		if (Number.isFinite(numeric) && numeric > 0) {
			return numeric;
		}
	}

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

function getAvailableStock(product) {
	return Math.max(0, Number(product?.stock_quantity || 0));
}

function isProductReservable(product) {
	const minimumQuantity = 1;
	const availableStock = getAvailableStock(product);

	return availableStock >= minimumQuantity;
}

export default function MarketplaceScreen() {
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
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
	const [toastState, setToastState] = useState({ visible: false, message: '' });
	const [confirmState, setConfirmState] = useState({
		visible: false,
		title: '',
		message: '',
		confirmLabel: 'Yes',
		onConfirm: null,
	});

	const showToast = (message) => {
		setToastState({ visible: true, message });
	};

	const openSellerChat = (source) => {
		const recipientId = getSellerRecipientId(source);
		const participantName = getPrimarySellerName(source);

		navigation.navigate('Messages', {
			recipientId: recipientId || undefined,
			participantName: participantName || undefined,
			chatIntentAt: Date.now(),
		});
	};

	const readCartItems = useCallback(async () => {
		try {
			const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
			if (!raw) {
				return [];
			}

			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}, []);

	const loadCartFromStorage = useCallback(async () => {
		const storedItems = await readCartItems();
		setCartItems(storedItems);
		return storedItems;
	}, [readCartItems]);

	const saveCartToStorage = useCallback(async (nextItems) => {
		setCartItems(nextItems);
		try {
			await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextItems));
		} catch {
			setError('Unable to update cart right now.');
		}
	}, []);

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
		void loadCartFromStorage();
	}, [loadCartFromStorage]);

	useEffect(() => {
		if (!toastState.visible) {
			return undefined;
		}

		const timer = setTimeout(() => {
			setToastState((prev) => ({ ...prev, visible: false }));
		}, 1800);

		return () => clearTimeout(timer);
	}, [toastState.visible]);

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
			void loadCartFromStorage();
		}, [loadCartFromStorage])
	);

	const filteredProducts = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return products.filter((product) => {
			const sellerRole = normalizeSellerRole(product);
			const productTypeFields = [product?.category, product?.type, product?.product_type]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			if (selectedTypeFilter !== 'all') {
				if (selectedTypeFilter === 'cafe menus') {
					if (sellerRole !== 'cafe') {
						return false;
					}
				} else if (!productTypeFields.includes(selectedTypeFilter)) {
					return false;
				}
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

	const getMinimumQuantity = useCallback((product) => {
		const sellerRole = normalizeSellerRole(product);
		if (sellerRole === 'cafe') return 1;
		return Math.max(1, Number(product?.moq || 1));
	}, []);

	const getMaximumQuantity = useCallback((product) => {
		const sellerRole = normalizeSellerRole(product);
		if (sellerRole === 'cafe') return Math.max(0, Number(product?.stock_quantity || 0));
		return Math.max(0, Number(product?.stock_quantity || 0));
	}, []);

	const clampToOrderableQuantity = useCallback((value, minimumQuantity, maximumQuantity) => {
		const numericValue = Number(String(value || '').replace(/[^0-9]/g, '') || 0);
		if (!Number.isFinite(numericValue) || numericValue < minimumQuantity) {
			return minimumQuantity;
		}

		if (maximumQuantity >= minimumQuantity && numericValue > maximumQuantity) {
			return maximumQuantity;
		}

		return numericValue;
	}, []);

	const openReserveModal = (product, action = 'order') => {
		if (!isProductReservable(product)) {
			setError('This product is currently unavailable.');
			return;
		}

		setSelectedProduct(product);
		setModalAction(action);
		setOrderQuantity(getMinimumQuantity(product));
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

		const latestSelectedProduct =
			products.find((product) => Number(product?.id) === Number(selectedProduct?.id)) || selectedProduct;
		const minimumQuantity = getMinimumQuantity(latestSelectedProduct);
		const maximumQuantity = getMaximumQuantity(latestSelectedProduct);
		const quantity = Number(orderQuantity || 0);

		if (!isProductReservable(latestSelectedProduct)) {
			setError('This product is currently unavailable.');
			setReserveModalOpen(false);
			setSelectedProduct(null);
			return;
		}

		if (!Number.isFinite(quantity) || quantity < minimumQuantity) {
			setError(`Quantity must be at least ${minimumQuantity}.`);
			return;
		}

		if (quantity > maximumQuantity) {
			setError('Requested quantity is currently unavailable.');
			setOrderQuantity(Math.max(minimumQuantity, maximumQuantity));
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

		const product = latestSelectedProduct;
		const action = modalAction;
		const selectedQuantity = quantity;
		const selectedPickupDate = pickupDate;
		const selectedPickupTime = pickupTime;

		// Close native modal first to avoid stacked modal input deadlocks.
		setReserveModalOpen(false);
		setSelectedProduct(null);
		setShowNativeDatePicker(false);
		setShowNativeTimePicker(false);

		if (action === 'cart') {
			const cartEntry = {
				id: `${product.id}-${Date.now()}`,
				product,
				quantity: selectedQuantity,
				pickup_date: selectedPickupDate,
				pickup_time: selectedPickupTime,
				added_at: new Date().toISOString(),
			};

			const currentItems = await readCartItems();
			const nextItems = [...currentItems, cartEntry];
			await saveCartToStorage(nextItems);
			showToast('Added to cart');
			return;
		}

		openConfirm({
			title:
				normalizeSellerRole(product) === 'farm' || normalizeSellerRole(product) === 'reseller'
					? 'Continue Reservation'
					: 'Confirm Reserve',
			message:
				normalizeSellerRole(product) === 'farm' || normalizeSellerRole(product) === 'reseller'
					? 'Continue this reservation on the web form?'
					: 'Reserve this product now in-app?',
			confirmLabel:
				normalizeSellerRole(product) === 'farm' || normalizeSellerRole(product) === 'reseller'
					? 'Open Web Form'
					: 'Yes, Confirm',
			onConfirm: async () => {
				if (!product?.id) {
					return;
				}

				setSubmittingOrder(true);
				setError('');

				try {
					const sellerRole = normalizeSellerRole(product);
					const requiresWebHandoff = sellerRole === 'farm' || sellerRole === 'reseller';

					if (!requiresWebHandoff) {
						await placeOrder({
							product_id: product.id,
							quantity: selectedQuantity,
							pickup_date: selectedPickupDate || null,
							pickup_time: selectedPickupTime || null,
							notes: null,
						});

						setActiveTab(TAB_TRACKING);
						await fetchMarketplaceData(true);
						showToast('Reservation placed in-app successfully.');
						return;
					}

					let prefillToken = '';
					try {
						const prefillResponse = await createLandingReservationPrefillToken({
							product_id: product.id,
							quantity: selectedQuantity,
							pickup_date: selectedPickupDate || null,
							pickup_time: selectedPickupTime || null,
						});
						prefillToken = String(prefillResponse?.prefill_token || '').trim();
					} catch (_prefillError) {
						prefillToken = '';
					}

					const landingUrl = buildLandingReservationUrl({
						productId: product.id,
						quantity: selectedQuantity,
						prefillToken,
					});

					if (!landingUrl) {
						throw new Error('Landing page URL is not configured. Set EXPO_PUBLIC_WEB_URL or EXPO_PUBLIC_API_URL.');
					}

					const canOpen = await Linking.canOpenURL(landingUrl);
					if (!canOpen) {
						throw new Error('Unable to open the landing reservation page on this device.');
					}

					await Linking.openURL(landingUrl);
					showToast(
						prefillToken
							? 'Landing form opened for farm/reseller reservation. Name/email may be prefilled. Enter address and contact number on web.'
							: `Landing form opened for farm/reseller reservation. Complete it on web and enter address/contact${user?.email ? ` (${user.email})` : ''}.`
					);
				} catch (submitError) {
					const message =
						submitError?.response?.data?.message ||
						submitError?.message ||
						'Unable to continue reservation on the web form right now.';
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
		const sellerRole = normalizeSellerRole(item);
		const stock = getAvailableStock(item);
		const minimum = getMinimumQuantity(item);
		const reservable = stock >= minimum;
		const productType = item?.category || item?.type || item?.product_type || null;
		const roastType = item?.roast_type || item?.roast_level || item?.roast || null;
		const grindType = item?.grind_type || item?.grind || null;
		const sellerRoleTheme = sellerRole ? ROLE_PILL_THEME[sellerRole] : null;
		const usesWebCheckout = sellerRole === 'farm' || sellerRole === 'reseller';
		const sellerDisplayName = getSellerDisplayName(item);
		const detailParts = [];
		if (productType) {
			detailParts.push(String(productType));
		}
		if (roastType) {
			detailParts.push(`Roast: ${roastType}`);
		}
		if (grindType) {
			detailParts.push(`Grind: ${grindType}`);
		}

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
					<Text style={styles.productMeta}>{sellerDisplayName}</Text>

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

					<View
						style={[
							styles.checkoutModePill,
							usesWebCheckout ? styles.checkoutModePillWeb : styles.checkoutModePillInApp,
						]}
					>
						<Text
							style={[
								styles.checkoutModePillText,
								usesWebCheckout ? styles.checkoutModePillTextWeb : styles.checkoutModePillTextInApp,
							]}
						>
							{usesWebCheckout ? 'Web Checkout' : 'In-App Checkout'}
						</Text>
					</View>

					{detailParts.length ? (
						<View style={styles.productDetailRow}>
							{detailParts.map((part, index) => (
								<View key={`${part}-${index}`} style={styles.productDetailItem}>
									{index > 0 ? (
										<MaterialIcons name="auto-awesome" size={12} color="#8A7D6D" style={styles.productDetailIcon} />
									) : null}
									<Text style={styles.productRoastGrind}>{part}</Text>
								</View>
							))}
						</View>
					) : null}

					<Text numberOfLines={2} style={styles.productDescription}>
						{item?.description || 'No description available.'}
					</Text>

					<View style={styles.productInfoRow}>
						<Text style={styles.productPrice}>{money(item?.price_per_unit)}{sellerRole !== 'cafe' && item?.unit ? ` / ${item.unit}` : ''}</Text>
						{sellerRole !== 'cafe' && (
							<Text style={styles.productStock}>{`Stock: ${stock}`}</Text>
						)}
					</View>
					{sellerRole !== 'cafe' && (
						<Text style={styles.productHint}>{`MOQ: ${item?.moq || 1}${item?.unit ? ` ${item.unit}` : ''}`}</Text>
					)}
					{!reservable ? <Text style={styles.unavailableHint}>{sellerRole === 'cafe' ? 'Unavailable' : 'Out of stock'}</Text> : null}

					<View style={styles.productActionsRow}>
						<Pressable
							style={[styles.reserveButton, !reservable && styles.actionButtonDisabled]}
							onPress={() => openReserveModal(item, 'order')}
							disabled={!reservable}
						>
							<MaterialIcons name="bolt" size={16} color={theme.colors.white} />
							<Text style={styles.reserveButtonText}>{reservable ? 'Reserve Now' : 'Unavailable'}</Text>
						</Pressable>
						<Pressable
							style={[styles.addToCartButton, !reservable && styles.addToCartButtonDisabled]}
							onPress={() => openReserveModal(item, 'cart')}
							disabled={!reservable}
						>
							<MaterialIcons
								name="add-shopping-cart"
								size={16}
								color={!reservable ? '#8B8B8B' : theme.colors.primary}
							/>
							<Text style={[styles.addToCartButtonText, !reservable && styles.addToCartButtonTextDisabled]}>
								Add to Cart
							</Text>
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
		const cancellable = activeTab === TAB_TRACKING && normalizedStatus === 'pending';
		const sellerDisplayName = getSellerDisplayName(item);

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
						<Text style={styles.orderSellerMeta}>{sellerDisplayName}</Text>
						<Text style={styles.orderDetail}>Qty: {item?.quantity || 0}</Text>
						<Text style={styles.orderDetail}>Total: {money(item?.total_price)}</Text>
						<Text style={styles.orderDetail}>
							Pickup: {formatDisplayDateTime(item?.pickup_date, item?.pickup_time)}
						</Text>
						<Pressable style={styles.chatSellerButton} onPress={() => openSellerChat(item)}>
							<MaterialIcons name="chat-bubble-outline" size={14} color={theme.colors.white} />
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
				<Text style={styles.subtitle}>Reserve fresh coffee products and track your orders</Text>
				<View style={styles.handoffBanner}>
					<MaterialIcons name="open-in-browser" size={16} color="#2D4A1E" />
					<Text style={styles.handoffBannerText}>
						Farm owner and reseller products continue on landing web form. Cafe owner products are reserved in-app.
					</Text>
				</View>
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
						{(() => {
									const sellerRole = normalizeSellerRole(selectedProduct);
									return (
										<>
											<Text style={styles.modalTitle}>{modalAction === 'cart' ? 'Add to Cart' : 'Reserve Product'}</Text>

											<Text style={styles.modalProductName}>{selectedProduct?.name || ''}</Text>
											<Text style={styles.modalDetail}>{money(selectedProduct?.price_per_unit)}</Text>

											<View style={styles.modalFieldWrap}>
												<Text style={styles.modalLabel}>Quantity</Text>
												<View style={styles.quantitySelectorRow}>
													<Pressable
														style={[styles.quantityStepButton, !canDecreaseQuantity && styles.quantityStepButtonDisabled]}
														onPress={() => {
															if (!canDecreaseQuantity) {
																return;
															}

															setOrderQuantity((currentValue) =>
																clampToOrderableQuantity(Number(currentValue || minimumQuantity) - 1, minimumQuantity, availableStock)
															);
														}}
														disabled={!canDecreaseQuantity}
													>
														<Text style={styles.quantityStepText}>-</Text>
													</Pressable>

													<TextInput
														value={String(normalizedQuantity)}
														onChangeText={(value) => {
															setOrderQuantity(clampToOrderableQuantity(value, minimumQuantity, availableStock));
														}}
														onBlur={() => {
															setOrderQuantity((currentValue) =>
																clampToOrderableQuantity(currentValue, minimumQuantity, availableStock)
															);
														}}
														keyboardType="number-pad"
														style={[styles.modalInput, styles.quantityInput]}
														editable={reservable}
													/>

													<Pressable
														style={[styles.quantityStepButton, !canIncreaseQuantity && styles.quantityStepButtonDisabled]}
														onPress={() => {
															if (!canIncreaseQuantity) {
																return;
															}

															setOrderQuantity((currentValue) =>
																clampToOrderableQuantity(Number(currentValue || minimumQuantity) + 1, minimumQuantity, availableStock)
															);
														}}
														disabled={!canIncreaseQuantity}
													>
														<Text style={styles.quantityStepText}>+</Text>
													</Pressable>
												</View>
											</View>

											{(sellerRole === 'farm' || sellerRole === 'reseller') && (
												<View style={styles.modalFieldWrap}>
													<Text style={styles.modalLabel}>Available Stock</Text>
													<Text style={styles.modalDetail}>{availableStock}</Text>
													<Text style={styles.modalLabel}>MOQ</Text>
													<Text style={styles.modalDetail}>{selectedProduct?.moq || 1}{selectedProduct?.unit ? ` ${selectedProduct.unit}` : ''}</Text>
												</View>
											)}

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

						<View style={styles.modalActionsRow}>
							<Pressable style={styles.modalCancelButton} onPress={closeReserveModal}>
								<Text style={styles.modalCancelText}>Cancel</Text>
							</Pressable>

							<Pressable
								style={[styles.modalSubmitButton, (!reservable || submittingOrder) && styles.actionButtonDisabled]}
								onPress={submitOrder}
								disabled={!reservable || submittingOrder}
							>
								<Text style={styles.modalSubmitText}>
									{submittingOrder
										? modalAction === 'cart'
											? 'Adding...'
											: 'Reserving...'
										: !reservable
											? 'Unavailable'
										: modalAction === 'cart'
											? 'Add to Cart'
											: 'Reserve Now'}
								</Text>
							</Pressable>
						</View>
								</>
							);
						})()}
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

			{toastState.visible ? (
				<View style={[styles.toastWrap, { top: Math.max(insets.top + 10, 18) }]} pointerEvents="none">
					<Text style={styles.toastText}>{toastState.message}</Text>
				</View>
			) : null}
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
		backgroundColor: MARKETPLACE_ACTION_GREEN,
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
	handoffBanner: {
		marginTop: 10,
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 8,
		backgroundColor: '#EEF6E6',
		borderWidth: 1,
		borderColor: '#C7DBB4',
		borderRadius: theme.borderRadius.md,
		paddingVertical: 8,
		paddingHorizontal: 10,
	},
	handoffBannerText: {
		flex: 1,
		color: '#2D4A1E',
		fontFamily: 'PoppinsRegular',
		fontSize: 12,
		lineHeight: 17,
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
	checkoutModePill: {
		alignSelf: 'flex-start',
		marginTop: 6,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: theme.borderRadius.pill,
		borderWidth: 1,
	},
	checkoutModePillWeb: {
		backgroundColor: '#EEF6E6',
		borderColor: '#C7DBB4',
	},
	checkoutModePillInApp: {
		backgroundColor: '#E8F3FC',
		borderColor: '#B8D5EF',
	},
	checkoutModePillText: {
		fontFamily: 'PoppinsMedium',
		fontSize: 10,
		lineHeight: 13,
		textTransform: 'uppercase',
	},
	checkoutModePillTextWeb: {
		color: '#2D4A1E',
	},
	checkoutModePillTextInApp: {
		color: '#155E9A',
	},
	productRoastGrind: {
		color: '#6B5B4A',
		fontSize: theme.fontSizes.xs,
		fontFamily: 'PoppinsMedium',
	},
	productDetailRow: {
		marginTop: 4,
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
	},
	productDetailItem: {
		flexDirection: 'row',
		alignItems: 'center',
		marginRight: 8,
		marginBottom: 2,
	},
	productDetailIcon: {
		marginRight: 4,
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
	productStockOut: {
		color: '#B00020',
		fontWeight: '700',
	},
	productHint: {
		marginTop: 4,
		color: '#826D54',
		fontSize: theme.fontSizes.xs,
		fontFamily: theme.fonts.body,
	},
	unavailableHint: {
		marginTop: 6,
		color: '#B00020',
		fontSize: theme.fontSizes.xs,
		fontFamily: 'PoppinsMedium',
	},
	productActionsRow: {
		marginTop: 12,
		flexDirection: 'row',
		gap: 8,
	},
	reserveButton: {
		flex: 1,
		backgroundColor: MARKETPLACE_ACTION_GREEN,
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
	actionButtonDisabled: {
		opacity: 0.55,
	},
	addToCartButtonDisabled: {
		borderColor: '#C9C9C9',
		backgroundColor: '#F2F2F2',
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
	addToCartButtonTextDisabled: {
		color: '#8B8B8B',
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
	orderSellerMeta: {
		marginTop: 2,
		color: '#826D54',
		fontSize: theme.fontSizes.xs,
		fontFamily: 'PoppinsRegular',
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
		borderColor: MARKETPLACE_ACTION_GREEN,
		backgroundColor: MARKETPLACE_ACTION_GREEN,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	chatSellerButtonText: {
		color: theme.colors.white,
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
	modalDetailWarning: {
		color: '#B00020',
		fontFamily: 'PoppinsMedium',
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
	quantitySelectorRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	quantityStepButton: {
		width: 38,
		height: 38,
		borderRadius: theme.borderRadius.sm,
		borderWidth: 1,
		borderColor: theme.colors.primary,
		backgroundColor: '#EEF4E8',
		alignItems: 'center',
		justifyContent: 'center',
	},
	quantityStepButtonDisabled: {
		opacity: 0.45,
	},
	quantityStepText: {
		fontSize: theme.fontSizes.lg,
		fontFamily: 'PoppinsBold',
		color: theme.colors.primary,
		lineHeight: 22,
	},
	quantityInput: {
		flex: 1,
		textAlign: 'center',
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
		backgroundColor: MARKETPLACE_ACTION_GREEN,
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
		backgroundColor: MARKETPLACE_ACTION_GREEN,
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
	toastWrap: {
		position: 'absolute',
		left: theme.spacing.md,
		right: theme.spacing.md,
		backgroundColor: 'rgba(45, 74, 30, 0.96)',
		borderRadius: theme.borderRadius.md,
		paddingVertical: 10,
		paddingHorizontal: 12,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 30,
		...theme.shadows.sm,
	},
	toastText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsMedium',
		fontSize: theme.fontSizes.sm,
	},
});

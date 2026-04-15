import { useCallback, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Image,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { ScreenContainer } from '../../components';
import { API_CONFIG, getMyOrders, getProducts, placeOrder, updateOrderStatus } from '../../services';
import theme from '../../theme';

const TAB_PRODUCTS = 'products';
const TAB_TRACKING = 'tracking';
const TAB_HISTORY = 'history';

const PICKUP_TIME_OPTIONS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

function buildPickupDateOptions(days = 7) {
	const options = [];
	const now = new Date();

	for (let i = 0; i < days; i += 1) {
		const date = new Date(now);
		date.setDate(now.getDate() + i);

		const yyyy = date.getFullYear();
		const mm = String(date.getMonth() + 1).padStart(2, '0');
		const dd = String(date.getDate()).padStart(2, '0');

		options.push({
			value: `${yyyy}-${mm}-${dd}`,
			label: `${mm}/${dd}`,
		});
	}

	return options;
}

function money(value) {
	return `PHP ${Number(value || 0).toFixed(2)}`;
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
	const [activeTab, setActiveTab] = useState(TAB_PRODUCTS);
	const [products, setProducts] = useState([]);
	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState('');
	const [query, setQuery] = useState('');
	const [reserveModalOpen, setReserveModalOpen] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState(null);
	const [orderQuantity, setOrderQuantity] = useState(1);
	const [pickupDate, setPickupDate] = useState('');
	const [pickupTime, setPickupTime] = useState('');
	const [orderNotes, setOrderNotes] = useState('');
	const [submittingOrder, setSubmittingOrder] = useState(false);
	const [cancellingOrderId, setCancellingOrderId] = useState(null);

	const pickupDateOptions = useMemo(() => buildPickupDateOptions(7), []);

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
		if (!normalizedQuery) {
			return products;
		}

		return products.filter((product) => {
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
	}, [products, query]);

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

	const openReserveModal = (product) => {
		setSelectedProduct(product);
		setOrderQuantity(Math.max(1, Number(product?.moq || 1)));
		setPickupDate(pickupDateOptions[0]?.value || '');
		setPickupTime(PICKUP_TIME_OPTIONS[0]);
		setOrderNotes('');
		setReserveModalOpen(true);
	};

	const closeReserveModal = () => {
		if (submittingOrder) {
			return;
		}

		setReserveModalOpen(false);
		setSelectedProduct(null);
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

		setSubmittingOrder(true);
		setError('');

		try {
			await placeOrder({
				product_id: selectedProduct.id,
				quantity,
				pickup_date: pickupDate || null,
				pickup_time: pickupTime || null,
				notes: orderNotes.trim() || null,
			});

			setReserveModalOpen(false);
			setActiveTab(TAB_TRACKING);
			await fetchMarketplaceData(false);
		} catch (submitError) {
			const message =
				submitError?.response?.data?.message ||
				submitError?.message ||
				'Unable to submit order right now.';
			setError(message);
		} finally {
			setSubmittingOrder(false);
		}
	};

	const cancelOrder = async (order) => {
		if (!order?.id) {
			return;
		}

		setCancellingOrderId(order.id);
		setError('');

		try {
			await updateOrderStatus(order.id, 'cancelled');
			await fetchMarketplaceData(false);
		} catch (cancelError) {
			const message =
				cancelError?.response?.data?.message ||
				cancelError?.message ||
				'Unable to cancel order right now.';
			setError(message);
		} finally {
			setCancellingOrderId(null);
		}
	};

	const renderProductCard = ({ item }) => {
		const imageUrl = resolveImageUrl(item?.image_url);
		const stock = Math.max(0, Number(item?.stock_quantity || 0));
		const minimum = Math.max(1, Number(item?.moq || 1));

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

					<Text numberOfLines={2} style={styles.productDescription}>
						{item?.description || 'No description available.'}
					</Text>

					<View style={styles.productInfoRow}>
						<Text style={styles.productPrice}>{money(item?.price_per_unit)}</Text>
						<Text style={styles.productStock}>Stock: {stock}</Text>
					</View>

					<Text style={styles.productHint}>MOQ: {minimum} {item?.unit || 'kg'}</Text>

					<Pressable style={styles.reserveButton} onPress={() => openReserveModal(item)}>
						<MaterialIcons name="event-available" size={16} color={theme.colors.white} />
						<Text style={styles.reserveButtonText}>Reserve / Order</Text>
					</Pressable>
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
						{item?.notes ? <Text style={styles.orderNotes}>Notes: {item.notes}</Text> : null}

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

	return (
		<ScreenContainer>
			<View style={styles.headerWrap}>
				<Text style={styles.title}>Marketplace</Text>
				<Text style={styles.subtitle}>Reserve fresh coffee products and track your orders</Text>
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
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMarketplaceData(true)} tintColor={theme.colors.primary} />}
					contentContainerStyle={styles.listContent}
					showsVerticalScrollIndicator={false}
					ListEmptyComponent={
						<View style={styles.emptyStateWrap}>
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
						<Text style={styles.modalTitle}>Reserve Product</Text>

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
							<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
								{pickupDateOptions.map((option) => (
									<Pressable
										key={option.value}
										style={[
											styles.optionChip,
											pickupDate === option.value && styles.optionChipActive,
										]}
										onPress={() => setPickupDate(option.value)}
									>
										<Text
											style={[
												styles.optionChipText,
												pickupDate === option.value && styles.optionChipTextActive,
											]}
										>
											{option.label}
										</Text>
									</Pressable>
								))}
							</ScrollView>
							<Text style={styles.selectedOptionText}>{pickupDate || 'No date selected'}</Text>
						</View>

						<View style={styles.modalFieldWrap}>
							<Text style={styles.modalLabel}>Estimated Pickup Time</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
								{PICKUP_TIME_OPTIONS.map((timeValue) => (
									<Pressable
										key={timeValue}
										style={[
											styles.optionChip,
											pickupTime === timeValue && styles.optionChipActive,
										]}
										onPress={() => setPickupTime(timeValue)}
									>
										<Text
											style={[
												styles.optionChipText,
												pickupTime === timeValue && styles.optionChipTextActive,
											]}
										>
											{timeValue}
										</Text>
									</Pressable>
								))}
							</ScrollView>
							<Text style={styles.selectedOptionText}>{pickupTime || 'No time selected'}</Text>
						</View>

						<View style={styles.modalFieldWrap}>
							<Text style={styles.modalLabel}>Notes (optional)</Text>
							<TextInput
								value={orderNotes}
								onChangeText={setOrderNotes}
								placeholder="Special instructions"
								placeholderTextColor={theme.colors.textMuted}
								style={[styles.modalInput, styles.modalNotesInput]}
								multiline
							/>
						</View>

						<View style={styles.modalActionsRow}>
							<Pressable style={styles.modalCancelButton} onPress={closeReserveModal}>
								<Text style={styles.modalCancelText}>Cancel</Text>
							</Pressable>

							<Pressable style={styles.modalSubmitButton} onPress={submitOrder} disabled={submittingOrder}>
								<Text style={styles.modalSubmitText}>{submittingOrder ? 'Submitting...' : 'Submit Order'}</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</ScreenContainer>
	);
}

const styles = StyleSheet.create({
	headerWrap: {
		marginBottom: theme.spacing.md,
	},
	title: {
		fontSize: theme.fontSizes.xl,
		fontWeight: '700',
		color: theme.colors.sidebar,
		fontFamily: theme.fonts.display,
	},
	subtitle: {
		marginTop: 4,
		color: theme.colors.textMuted,
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	tabRow: {
		flexDirection: 'row',
		marginBottom: theme.spacing.md,
		backgroundColor: '#EFE6D7',
		borderRadius: theme.borderRadius.pill,
		padding: 4,
	},
	tabButton: {
		flex: 1,
		borderRadius: theme.borderRadius.pill,
		paddingVertical: 8,
		alignItems: 'center',
	},
	tabButtonActive: {
		backgroundColor: theme.colors.primary,
	},
	tabButtonText: {
		color: theme.colors.sidebar,
		fontWeight: '600',
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	tabButtonTextActive: {
		color: theme.colors.white,
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
	listContent: {
		paddingBottom: 110,
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
		fontFamily: theme.fonts.display,
		fontWeight: '700',
	},
	productMeta: {
		marginTop: 2,
		color: theme.colors.textMuted,
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
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
	reserveButton: {
		marginTop: 12,
		backgroundColor: theme.colors.primary,
		borderRadius: theme.borderRadius.md,
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
		fontFamily: theme.fonts.body,
	},
	orderDetail: {
		marginTop: 2,
		color: theme.colors.textMuted,
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	orderNotes: {
		marginTop: 4,
		color: '#6B5B4A',
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	errorText: {
		marginBottom: theme.spacing.sm,
		color: '#B00020',
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
	emptyStateWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: theme.spacing.xl,
		gap: 10,
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
		fontFamily: theme.fonts.display,
	},
	modalProductName: {
		marginTop: 8,
		color: theme.colors.sidebar,
		fontWeight: '700',
		fontFamily: theme.fonts.body,
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
	modalNotesInput: {
		minHeight: 70,
		textAlignVertical: 'top',
	},
	optionRow: {
		paddingVertical: 2,
		gap: 8,
	},
	optionChip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: theme.borderRadius.pill,
		borderWidth: 1,
		borderColor: theme.colors.border,
		backgroundColor: '#FCFAF7',
	},
	optionChipActive: {
		backgroundColor: theme.colors.primary,
		borderColor: theme.colors.primary,
	},
	optionChipText: {
		color: theme.colors.sidebar,
		fontSize: theme.fontSizes.sm,
		fontWeight: '600',
		fontFamily: theme.fonts.body,
	},
	optionChipTextActive: {
		color: theme.colors.white,
	},
	selectedOptionText: {
		marginTop: 6,
		fontSize: theme.fontSizes.xs,
		color: theme.colors.textMuted,
		fontFamily: theme.fonts.body,
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
});

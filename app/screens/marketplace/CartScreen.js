import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	Alert,
	Image,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ConfirmToastModal, ScreenContainer } from '../../components';
import { API_CONFIG, placeOrder } from '../../services';
import theme from '../../theme';

const CART_STORAGE_KEY = 'marketplace_cart_items';

function money(value) {
	return `PHP ${Number(value || 0).toFixed(2)}`;
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

function normalizeBusinessName(name) {
	return String(name || '').replace(/Cafe and Restaurant/gi, 'Cafe & Restaurant').trim();
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
		return `${sellerName} • ${establishmentName}`;
	}

	return sellerName || 'Seller';
}

function resolveImageUrl(pathOrUrl) {
	if (!pathOrUrl) return null;
	const raw = String(pathOrUrl).trim();
	if (!raw) return null;

	const runtimeApiBase = process.env.EXPO_PUBLIC_API_URL || API_CONFIG?.baseUrl;
	const baseUrl = String(runtimeApiBase || '').replace(/\/+$/, '');
	const apiOriginMatch = baseUrl.match(/^(https?:\/\/[^/]+)/i);
	const apiOrigin = apiOriginMatch ? apiOriginMatch[1] : baseUrl;

	if (/^https?:\/\//i.test(raw)) return raw;
	if (!apiOrigin) return raw;

	const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
	if (/^\/storage\//i.test(normalizedPath)) {
		return `${apiOrigin}${normalizedPath}`;
	}

	return `${apiOrigin}/storage/${raw.replace(/^\/+/, '')}`;
}

export default function MarketplaceCartScreen() {
	const navigation = useNavigation();
	const [cartItems, setCartItems] = useState([]);
	const [selectedItem, setSelectedItem] = useState(null);
	const [submittingId, setSubmittingId] = useState(null);
	const [confirmState, setConfirmState] = useState({
		visible: false,
		title: '',
		message: '',
		confirmLabel: 'Yes',
		onConfirm: null,
	});

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

	const loadCartItems = useCallback(async () => {
		const currentItems = await readCartItems();
		setCartItems(currentItems);
	}, [readCartItems]);

	const saveCartItems = useCallback(async (nextItems) => {
		setCartItems(nextItems);
		try {
			await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextItems));
		} catch {
			// Keep UI responsive even if persistence fails.
		}
	}, []);

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

	useEffect(() => {
		void loadCartItems();
	}, [loadCartItems]);

	useFocusEffect(
		useCallback(() => {
			void loadCartItems();
		}, [loadCartItems])
	);

	const totalItems = useMemo(() => cartItems.length, [cartItems]);

	const removeCartItem = (itemId) => {
		openConfirm({
			title: 'Confirm Remove',
			message: 'Remove this item from cart?',
			confirmLabel: 'Yes, Remove',
			onConfirm: async () => {
				const currentItems = await readCartItems();
				const nextItems = currentItems.filter((entry) => entry.id !== itemId);
				await saveCartItems(nextItems);
			},
		});
	};

	const orderNow = (item) => {
		if (!item?.product?.id) return;

		openConfirm({
			title: 'Confirm Order',
			message: 'Place this cart item as an order now?',
			confirmLabel: 'Yes, Order',
			onConfirm: async () => {
				setSubmittingId(item.id);
				try {
					await placeOrder({
						product_id: item.product.id,
						quantity: Number(item.quantity || 1),
						pickup_date: item.pickup_date || null,
						pickup_time: item.pickup_time || null,
						notes: null,
					});

					const currentItems = await readCartItems();
					const nextItems = currentItems.filter((entry) => entry.id !== item.id);
					await saveCartItems(nextItems);
					Alert.alert('Order Placed', 'Your cart item was ordered successfully.');
				} catch (error) {
					const message =
						error?.response?.data?.message ||
						error?.message ||
						'Unable to place this order right now.';
					Alert.alert('Order Failed', message);
				} finally {
					setSubmittingId(null);
				}
			},
		});
	};

	return (
		<ScreenContainer>
			<View style={styles.headerRow}>
				<Text style={styles.title}>Cart</Text>
				<Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
					<MaterialIcons name="arrow-back" size={16} color="#FFFFFF" />
					<Text style={styles.backButtonText}>Back</Text>
				</Pressable>
			</View>
			<Text style={styles.subtitle}>{totalItems} item{totalItems === 1 ? '' : 's'} in cart</Text>

			{cartItems.length === 0 ? (
				<View style={styles.emptyWrap}>
					<MaterialIcons name="shopping-cart" size={28} color="#A6947E" />
					<Text style={styles.emptyText}>Your cart is empty.</Text>
				</View>
			) : (
				<ScrollView contentContainerStyle={styles.listWrap} showsVerticalScrollIndicator={false}>
					{cartItems.map((item) => {
						const imageUrl = resolveImageUrl(item?.product?.image_url);
						const sellerDisplayName = getSellerDisplayName(item);

						return (
							<View key={item.id} style={styles.cartItemCard}>
								<View style={styles.cartItemRow}>
									{imageUrl ? (
										<Image source={{ uri: imageUrl }} style={styles.cartItemImage} />
									) : (
										<View style={[styles.cartItemImage, styles.cartItemImagePlaceholder]}>
											<MaterialIcons name="inventory-2" size={18} color="#A6947E" />
										</View>
									)}
									<View style={styles.cartItemTextWrap}>
										<Text style={styles.cartItemName}>{item?.product?.name || 'Product'}</Text>
										<Text style={styles.cartItemMeta}>{sellerDisplayName}</Text>
										<Text style={styles.cartItemMeta}>Qty: {item.quantity}</Text>
										<Text style={styles.cartItemMeta}>Price: {money(item?.product?.price_per_unit)}</Text>
									</View>
								</View>

								<View style={styles.cartItemActions}>
									<Pressable style={styles.viewDetailsButton} onPress={() => setSelectedItem(item)}>
										<Text style={styles.viewDetailsButtonText}>View Details</Text>
									</Pressable>
									<Pressable style={styles.removeButton} onPress={() => removeCartItem(item.id)}>
										<Text style={styles.removeButtonText}>Remove</Text>
									</Pressable>
									<Pressable
										style={styles.orderNowButton}
										onPress={() => orderNow(item)}
										disabled={submittingId === item.id}
									>
										<Text style={styles.orderNowButtonText}>
											{submittingId === item.id ? 'Ordering...' : 'Order Now'}
										</Text>
									</Pressable>
								</View>
							</View>
						);
					})}
				</ScrollView>
			)}

			<Modal
				visible={!!selectedItem}
				transparent
				animationType="slide"
				onRequestClose={() => setSelectedItem(null)}
			>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						{(() => {
							const sellerDisplayName = getSellerDisplayName(selectedItem);
							return (
								<>
						<Text style={styles.modalTitle}>Cart Item Details</Text>
						<Text style={styles.modalDetailName}>{selectedItem?.product?.name || 'Product'}</Text>
						<Text style={styles.modalDetailText}>Seller: {sellerDisplayName}</Text>
						<Text style={styles.modalDetailText}>Quantity: {selectedItem?.quantity || 0}</Text>
						<Text style={styles.modalDetailText}>Pickup Date: {formatDisplayDate(selectedItem?.pickup_date)}</Text>
						<Text style={styles.modalDetailText}>Pickup Time: {formatDisplayTime(selectedItem?.pickup_time)}</Text>
						<Text style={styles.modalDetailText}>Unit Price: {money(selectedItem?.product?.price_per_unit)}</Text>
						<Text style={styles.modalDetailText}>MOQ: {selectedItem?.product?.moq || 1}</Text>
						<Pressable style={styles.closeModalButton} onPress={() => setSelectedItem(null)}>
							<Text style={styles.closeModalButtonText}>Close</Text>
						</Pressable>
							</>
							);
						})()}
					</View>
				</View>
			</Modal>

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
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 2,
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
		color: '#FFFFFF',
		fontFamily: 'PoppinsMedium',
		fontSize: theme.fontSizes.sm,
	},
	subtitle: {
		marginTop: 4,
		marginBottom: 10,
		color: theme.colors.textMuted,
		fontSize: theme.fontSizes.sm,
		fontFamily: 'PoppinsRegular',
	},
	emptyWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 46,
		gap: 8,
	},
	emptyText: {
		color: '#7D6E5E',
		fontFamily: 'PoppinsRegular',
		fontSize: theme.fontSizes.sm,
	},
	listWrap: {
		paddingBottom: 24,
	},
	cartItemCard: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.borderRadius.md,
		backgroundColor: '#FFFFFF',
		padding: 10,
		marginBottom: 10,
	},
	cartItemRow: {
		flexDirection: 'row',
		gap: 10,
	},
	cartItemImage: {
		width: 68,
		height: 68,
		borderRadius: theme.borderRadius.sm,
		backgroundColor: '#EFE6D7',
	},
	cartItemImagePlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	cartItemTextWrap: {
		flex: 1,
	},
	cartItemName: {
		color: theme.colors.sidebar,
		fontFamily: 'PoppinsBold',
		fontSize: theme.fontSizes.sm,
	},
	cartItemMeta: {
		marginTop: 2,
		color: theme.colors.textMuted,
		fontFamily: 'PoppinsRegular',
		fontSize: theme.fontSizes.xs,
	},
	cartItemActions: {
		marginTop: 10,
		flexDirection: 'row',
		gap: 8,
	},
	viewDetailsButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#2D4A1E',
		borderRadius: theme.borderRadius.sm,
		paddingVertical: 8,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#EEF4E8',
	},
	viewDetailsButtonText: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsMedium',
		fontSize: theme.fontSizes.xs,
	},
	removeButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#C62828',
		borderRadius: theme.borderRadius.sm,
		paddingVertical: 8,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#FFF5F5',
	},
	removeButtonText: {
		color: '#C62828',
		fontFamily: 'PoppinsMedium',
		fontSize: theme.fontSizes.xs,
	},
	orderNowButton: {
		flex: 1,
		borderRadius: theme.borderRadius.sm,
		paddingVertical: 8,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: theme.colors.primary,
	},
	orderNowButtonText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsMedium',
		fontSize: theme.fontSizes.xs,
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.35)',
		justifyContent: 'center',
		paddingHorizontal: theme.spacing.md,
	},
	modalCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: theme.borderRadius.lg,
		padding: theme.spacing.md,
	},
	modalTitle: {
		fontFamily: 'PoppinsBold',
		fontSize: theme.fontSizes.lg,
		color: theme.colors.sidebar,
	},
	modalDetailName: {
		marginTop: 8,
		color: theme.colors.sidebar,
		fontFamily: 'PoppinsBold',
		fontSize: theme.fontSizes.md,
	},
	modalDetailText: {
		marginTop: 4,
		color: theme.colors.textMuted,
		fontFamily: 'PoppinsRegular',
		fontSize: theme.fontSizes.sm,
	},
	closeModalButton: {
		marginTop: 14,
		borderRadius: theme.borderRadius.md,
		backgroundColor: theme.colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 10,
	},
	closeModalButtonText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsBold',
		fontSize: theme.fontSizes.sm,
	},
});
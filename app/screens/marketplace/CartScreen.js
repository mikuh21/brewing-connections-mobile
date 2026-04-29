import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	Alert,
	Image,
	Linking,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ConfirmToastModal, ScreenContainer } from '../../components';
import { createLandingReservationPrefillToken, getProducts, placeOrder } from '../../services';
import { getImageUrl } from '../../utils/imageHelper';
import { buildMarketplaceLandingReservationUrl } from '../../utils/marketplaceWeb';
import { useAuth } from '../../context';
import theme from '../../theme';

const CART_STORAGE_KEY = 'marketplace_cart_items';
const MARKETPLACE_ACTION_GREEN = '#2D4A1E';

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

function getAvailableStock(product) {
	return Math.max(0, Number(product?.stock_quantity || 0));
}

function getMinimumQuantity(product) {
	const sellerRole = normalizeSellerRole(product);
	if (sellerRole === 'cafe') return 1;
	return Math.max(1, Number(product?.moq || 1));
}

function isProductReservable(product) {
	return getAvailableStock(product) >= getMinimumQuantity(product);
}


export default function MarketplaceCartScreen() {
	const navigation = useNavigation();
	const { user } = useAuth();
	const [cartItems, setCartItems] = useState([]);
	const [selectedItem, setSelectedItem] = useState(null);
	const [submittingId, setSubmittingId] = useState(null);
	const [reserveContactModalOpen, setReserveContactModalOpen] = useState(false);
	const [pendingReserveItem, setPendingReserveItem] = useState(null);
	const [reserveAddress, setReserveAddress] = useState('');
	const [reserveContactNumber, setReserveContactNumber] = useState('');
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

	const updateCartItemQuantity = useCallback(
		async (itemId, nextQuantity) => {
			const parsedQuantity = Math.max(1, Number(String(nextQuantity || '').replace(/[^0-9]/g, '') || 1));
			const currentItems = await readCartItems();
			const nextItems = currentItems.map((entry) =>
				entry.id === itemId ? { ...entry, quantity: parsedQuantity } : entry
			);
			await saveCartItems(nextItems);
			setSelectedItem((current) =>
				current && current.id === itemId ? { ...current, quantity: parsedQuantity } : current
			);
		},
		[readCartItems, saveCartItems]
	);

	const reserveNow = (item, contactDetails = null) => {
		if (!item?.product?.id) return;

		const minimumQuantity = getMinimumQuantity(item?.product);
		const availableStock = getAvailableStock(item?.product);
		const requestedQuantity = Number(item?.quantity || 0);
		const sellerRole = normalizeSellerRole(item?.product);

		if (!isProductReservable(item?.product)) {
			Alert.alert('Unavailable', 'This item is currently unavailable.');
			return;
		}

		if (!Number.isFinite(requestedQuantity) || requestedQuantity < minimumQuantity) {
			Alert.alert('Invalid quantity', `Quantity must be at least ${minimumQuantity}.`);
			return;
		}

		if (requestedQuantity > availableStock) {
			Alert.alert('Unavailable quantity', `Only ${availableStock} unit(s) are currently available.`);
			return;
		}

		if (sellerRole === 'cafe' && !contactDetails) {
			setPendingReserveItem(item);
			setReserveAddress(String(item?.address || user?.address || ''));
			setReserveContactNumber(String(item?.contact_number || user?.contact_number || ''));
			setReserveContactModalOpen(true);
			return;
		}

		const submittedAddress = String(contactDetails?.address || item?.address || user?.address || '').trim();
		const submittedContactNumber = String(
			contactDetails?.contact_number || item?.contact_number || user?.contact_number || ''
		)
			.replace(/\s+/g, '')
			.trim();

		if (sellerRole === 'cafe' && submittedAddress === '') {
			Alert.alert('Required Field', 'Address is required before reserving this item.');
			return;
		}

		if (sellerRole === 'cafe' && !/^09\d{9}$/.test(submittedContactNumber)) {
			Alert.alert('Invalid Contact Number', 'Contact number must be a valid 11-digit PH mobile number (09XXXXXXXXX).');
			return;
		}

		openConfirm({
			title:
				normalizeSellerRole(item?.product) === 'farm' || normalizeSellerRole(item?.product) === 'reseller'
					? 'Continue Reservation'
					: 'Confirm Reservation',
			message:
				normalizeSellerRole(item?.product) === 'farm' || normalizeSellerRole(item?.product) === 'reseller'
					? 'Continue this cart reservation on the web form?'
					: 'Reserve this item now?',
			confirmLabel:
				normalizeSellerRole(item?.product) === 'farm' || normalizeSellerRole(item?.product) === 'reseller'
					? 'Open Web Form'
					: 'Yes, Reserve',
			onConfirm: async () => {
				setSubmittingId(item.id);
				try {
					const productsPayload = await getProducts();
					const latestProducts = Array.isArray(productsPayload?.products) ? productsPayload.products : [];
					const latestProduct =
						latestProducts.find((product) => Number(product?.id) === Number(item?.product?.id)) || item.product;
					const latestMinimum = getMinimumQuantity(latestProduct);
					const latestStock = getAvailableStock(latestProduct);

					if (latestStock < latestMinimum) {
						Alert.alert('Unavailable', 'This item is currently unavailable. Please remove it from cart.');
						return;
					}

					if (requestedQuantity > latestStock) {
						Alert.alert('Unavailable quantity', 'Requested quantity is currently unavailable.');
						return;
					}

					const latestSellerRole = normalizeSellerRole(latestProduct);
					const requiresWebHandoff = latestSellerRole === 'farm' || latestSellerRole === 'reseller';

					if (!requiresWebHandoff) {
						await placeOrder({
							product_id: latestProduct.id,
							quantity: requestedQuantity,
							pickup_date: item.pickup_date || null,
							pickup_time: item.pickup_time || null,
							address: submittedAddress || null,
							contact_number: submittedContactNumber || null,
							notes: null,
						});

						const currentItems = await readCartItems();
						const nextItems = currentItems.filter((entry) => entry.id !== item.id);
						await saveCartItems(nextItems);
						Alert.alert('Reserved', 'Your cart item was reserved in-app successfully.');
						return;
					}

					let prefillToken = '';
					let landingUrl = '';
					try {
						const prefillResponse = await createLandingReservationPrefillToken({
							product_id: latestProduct.id,
							quantity: requestedQuantity,
							pickup_date: item.pickup_date || null,
							pickup_time: item.pickup_time || null,
						});
						prefillToken = String(prefillResponse?.prefill_token || '').trim();
						landingUrl = String(prefillResponse?.landing_url || '').trim();
					} catch (_prefillError) {
						prefillToken = '';
						landingUrl = '';
					}

					if (!landingUrl) {
						landingUrl = buildMarketplaceLandingReservationUrl({
							productId: latestProduct.id,
							quantity: requestedQuantity,
							prefillToken,
						});
					}

					if (!landingUrl) {
						throw new Error('Landing page URL is not configured. Set EXPO_PUBLIC_WEB_URL or EXPO_PUBLIC_API_URL.');
					}

					const canOpen = await Linking.canOpenURL(landingUrl);
					if (!canOpen) {
						throw new Error('Unable to open the landing reservation page on this device.');
					}

					await Linking.openURL(landingUrl);
					Alert.alert(
						'Continue on Web',
						prefillToken
							? 'Landing form opened for farm/reseller reservation. Name/email may be prefilled. Enter address and contact number on web.'
							: 'Landing form opened for farm/reseller reservation. Complete reservation on web and enter address/contact number.'
					);
				} catch (error) {
					const message =
						error?.response?.data?.message ||
						error?.message ||
						'Unable to continue reservation on the web form right now.';
					Alert.alert('Reservation Handoff Failed', message);
				} finally {
					setSubmittingId(null);
				}
			},
		});
	};

	const isReserveContactValid = () => {
		const normalizedAddr = String(reserveAddress || '').trim();
		const normalizedPhone = String(reserveContactNumber || '').replace(/\s+/g, '');
		return normalizedAddr.length >= 10 && /^09\d{9}$/.test(normalizedPhone);
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
			<View style={styles.handoffBanner}>
				<MaterialIcons name="open-in-browser" size={16} color="#2D4A1E" />
				<Text style={styles.handoffBannerText}>
					Farm owner and reseller products continue on landing web form. Cafe owner products are reserved in-app.
				</Text>
			</View>

			{cartItems.length === 0 ? (
				<View style={styles.emptyWrap}>
					<MaterialIcons name="shopping-cart" size={28} color="#A6947E" />
					<Text style={styles.emptyText}>Your cart is empty.</Text>
				</View>
			) : (
				<ScrollView contentContainerStyle={styles.listWrap} showsVerticalScrollIndicator={false}>
					{cartItems.map((item) => {
						const imageUrl = getImageUrl(item?.product?.image_url);
						const sellerDisplayName = getSellerDisplayName(item);
						const minimumQuantity = getMinimumQuantity(item?.product);
						const availableStock = getAvailableStock(item?.product);
						const reservable = availableStock >= minimumQuantity;
						const stockEnoughForItem = Number(item?.quantity || 0) <= availableStock;
						const reserveDisabled = !reservable || !stockEnoughForItem || submittingId === item.id;
						const sellerRole = normalizeSellerRole(item?.product);

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
										<Text style={styles.cartItemMeta}>Price: {money(item?.product?.price_per_unit)}{sellerRole !== 'cafe' && item?.product?.unit ? ` / ${item.product.unit}` : ''}</Text>
										{sellerRole !== 'cafe' && (
											<Text style={styles.cartItemMeta}>{`Stock: ${availableStock}`}</Text>
										)}
										{sellerRole !== 'cafe' && (
											<Text style={styles.cartItemMeta}>{`MOQ: ${item?.product?.moq || 1}${item?.product?.unit ? ` ${item.product.unit}` : ''}`}</Text>
										)}
										{!reservable ? <Text style={styles.cartItemMetaWarning}>{sellerRole === 'cafe' ? 'Unavailable' : 'Out of stock'}</Text> : null}
										{reservable && !stockEnoughForItem ? (
											<Text style={styles.cartItemMetaWarning}>{sellerRole === 'cafe' ? 'Quantity currently unavailable' : 'Quantity exceeds current stock'}</Text>
										) : null}
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
									style={[styles.orderNowButton, reserveDisabled && styles.orderNowButtonDisabled]}
									onPress={() => reserveNow(item)}
									disabled={reserveDisabled}
								>
									<Text style={[styles.orderNowButtonText, reserveDisabled && styles.orderNowButtonTextDisabled]}>
										{submittingId === item.id
											? 'Reserving...'
											: !reservable
												? 'Unavailable'
											: !stockEnoughForItem
												? (sellerRole === 'cafe' ? 'Adjust Quantity' : 'Adjust to available stock')
												: 'Reserve Now'}
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
							const sellerRole = normalizeSellerRole(selectedItem?.product);
							const minimumQuantity = getMinimumQuantity(selectedItem?.product);
							const availableStock = getAvailableStock(selectedItem?.product);
							return (
								<>
							<Text style={styles.modalTitle}>Cart Item Details</Text>
							<Text style={styles.modalDetailName}>{selectedItem?.product?.name || 'Product'}</Text>
							<Text style={styles.modalDetailText}>Seller: {sellerDisplayName}</Text>
							<Text style={styles.modalDetailText}>Quantity</Text>

							<View style={styles.quantitySelectorRow}>
								<Pressable
									style={styles.quantityStepButton}
									onPress={() => {
										const currentQuantity = Math.max(minimumQuantity, Number(selectedItem?.quantity || minimumQuantity));
										void updateCartItemQuantity(selectedItem.id, Math.max(minimumQuantity, currentQuantity - 1));
									}}
								>
									<Text style={styles.quantityStepText}>-</Text>
								</Pressable>

								<TextInput
									value={String(Math.max(minimumQuantity, Number(selectedItem?.quantity || minimumQuantity)))}
									onChangeText={(value) => {
										void updateCartItemQuantity(selectedItem.id, value);
									}}
									keyboardType="number-pad"
									style={[styles.modalInput, styles.quantityInput]}
								/>

								<Pressable
									style={styles.quantityStepButton}
									onPress={() => {
										const currentQuantity = Math.max(minimumQuantity, Number(selectedItem?.quantity || minimumQuantity));
										void updateCartItemQuantity(selectedItem.id, currentQuantity + 1);
									}}
								>
									<Text style={styles.quantityStepText}>+</Text>
								</Pressable>
							</View>

							{sellerRole !== 'cafe' && (
								<>
									<Text style={styles.modalDetailText}>{`Stock: ${availableStock}`}</Text>
									<Text style={styles.modalDetailText}>{`MOQ: ${selectedItem?.product?.moq || 1}${selectedItem?.product?.unit ? ` ${selectedItem.product.unit}` : ''}`}</Text>
								</>
							)}

							<Text style={styles.modalDetailText}>Pickup Date: {formatDisplayDate(selectedItem?.pickup_date)}</Text>
							<Text style={styles.modalDetailText}>Pickup Time: {formatDisplayTime(selectedItem?.pickup_time)}</Text>
							<Text style={styles.modalDetailText}>Price: {money(selectedItem?.product?.price_per_unit)}{sellerRole !== 'cafe' && selectedItem?.product?.unit ? ` / ${selectedItem.product.unit}` : ''}</Text>
							<Pressable style={styles.closeModalButton} onPress={() => setSelectedItem(null)}>
								<Text style={styles.closeModalButtonText}>Close</Text>
							</Pressable>
							</>
							);
						})()}
					</View>
				</View>
			</Modal>

			<Modal
				visible={reserveContactModalOpen}
				transparent
				animationType="slide"
				onRequestClose={() => {
					setReserveContactModalOpen(false);
					setPendingReserveItem(null);
				}}
			>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Reservation Details</Text>
						<Text style={styles.modalDetailText}>Address</Text>
						<TextInput
							value={reserveAddress}
							onChangeText={setReserveAddress}
							placeholder="Enter complete address"
							placeholderTextColor={theme.colors.textMuted}
							style={styles.modalInput}
						/>
						{reserveAddress.trim().length > 0 && reserveAddress.trim().length < 10 && (
							<Text style={styles.modalFieldError}>Enter a complete address (at least 10 characters).</Text>
						)}

						<Text style={[styles.modalDetailText, { marginTop: 10 }]}>Phone Number</Text>
						<TextInput
							value={reserveContactNumber}
							onChangeText={setReserveContactNumber}
							placeholder="09XXXXXXXXX"
							placeholderTextColor={theme.colors.textMuted}
							keyboardType="number-pad"
							style={styles.modalInput}
						/>
						{reserveContactNumber.length > 0 && !/^09\d{9}$/.test(reserveContactNumber) && (
							<Text style={styles.modalFieldError}>Use a valid PH mobile number format (09XXXXXXXXX).</Text>
						)}

						<View style={styles.cartItemActions}>
							<Pressable
								style={styles.viewDetailsButton}
								onPress={() => {
									setReserveContactModalOpen(false);
									setPendingReserveItem(null);
								}}
							>
								<Text style={styles.viewDetailsButtonText}>Cancel</Text>
							</Pressable>
							<Pressable
								style={[styles.orderNowButton, !isReserveContactValid() && styles.orderNowButtonDisabled]}
								onPress={() => {
									const currentItem = pendingReserveItem;
									setReserveContactModalOpen(false);
									setPendingReserveItem(null);
									if (currentItem) {
										reserveNow(currentItem, {
											address: reserveAddress,
											contact_number: reserveContactNumber,
										});
									}
								}}
								disabled={!isReserveContactValid()}
							>
								<Text style={[styles.orderNowButtonText, !isReserveContactValid() && styles.orderNowButtonTextDisabled]}>Continue</Text>
							</Pressable>
						</View>
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
		backgroundColor: MARKETPLACE_ACTION_GREEN,
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
	handoffBanner: {
		marginBottom: 10,
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
	cartItemMetaWarning: {
		color: '#B00020',
		fontFamily: 'PoppinsMedium',
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
		backgroundColor: MARKETPLACE_ACTION_GREEN,
	},
	orderNowButtonDisabled: {
		backgroundColor: '#BDBDBD',
	},
	orderNowButtonText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsMedium',
		fontSize: theme.fontSizes.xs,
	},
	orderNowButtonTextDisabled: {
		color: '#F7F7F7',
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
	quantitySelectorRow: {
		marginTop: 6,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	quantityStepButton: {
		width: 34,
		height: 34,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#D7C9B1',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#F8F3E9',
	},
	quantityStepText: {
		fontFamily: 'PoppinsBold',
		fontSize: 18,
		color: '#2D4A1E',
		lineHeight: 20,
	},
	modalInput: {
		height: 36,
		borderWidth: 1,
		borderColor: '#D7C9B1',
		borderRadius: 8,
		paddingHorizontal: 12,
		fontFamily: 'PoppinsMedium',
		fontSize: theme.fontSizes.sm,
		color: theme.colors.sidebar,
		backgroundColor: '#FFFFFF',
	},
	modalFieldError: {
		color: '#B43F3F',
		fontSize: theme.fontSizes.xs,
		marginTop: 4,
		fontFamily: 'PoppinsRegular',
	},
	quantityInput: {
		flex: 1,
		textAlign: 'center',
		minWidth: 72,
	},
	closeModalButton: {
		marginTop: 14,
		borderRadius: theme.borderRadius.md,
		backgroundColor: MARKETPLACE_ACTION_GREEN,
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
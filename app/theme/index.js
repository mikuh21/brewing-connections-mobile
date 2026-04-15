export const colors = {
	sidebar: '#3A2E22',
	background: '#F5F0E8',
	primary: '#4A6741',
	accentLight: '#3A5A31',
	accentGold: '#FFD700',
	white: '#FFFFFF',
	textMuted: '#9E8C78',
	border: '#E5E0DB',
};

export const fonts = {
	body: 'Poppins',
	display: 'PlayfairDisplay',
	fallback: 'System',
};

export const fontSizes = {
	xs: 12,
	sm: 14,
	md: 16,
	lg: 20,
	xl: 24,
	xxl: 32,
};

export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
};

export const borderRadius = {
	sm: 6,
	md: 10,
	lg: 16,
	pill: 999,
};

export const shadows = {
	sm: {
		shadowColor: '#000000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.08,
		shadowRadius: 2,
		elevation: 1,
	},
	md: {
		shadowColor: '#000000',
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.12,
		shadowRadius: 6,
		elevation: 3,
	},
	lg: {
		shadowColor: '#000000',
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.16,
		shadowRadius: 12,
		elevation: 6,
	},
};

const theme = {
	colors,
	fonts,
	fontSizes,
	spacing,
	borderRadius,
	shadows,
};

export default theme;


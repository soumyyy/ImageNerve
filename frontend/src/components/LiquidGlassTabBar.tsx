import React, { useEffect } from 'react';
import {
    View,
    Text,
    TouchableWithoutFeedback,
    StyleSheet,
    Dimensions,
    Platform,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

// The pill is a fixed width — large enough for two tabs with room to breathe
const PILL_WIDTH = 220;
const TAB_WIDTH = PILL_WIDTH / 2;
const PILL_HEIGHT = 54;
const BORDER_RADIUS = PILL_HEIGHT / 2;

type Tab = 'photos' | 'albums';

interface TabItem {
    key: Tab;
    label: string;
    icon: string;
    iconActive: string;
}

const TABS: TabItem[] = [
    { key: 'photos', label: 'Photos', icon: 'images-outline', iconActive: 'images' },
    { key: 'albums', label: 'Albums', icon: 'albums-outline', iconActive: 'albums' },
];

interface LiquidGlassTabBarProps {
    activeTab: Tab;
    onTabPress: (tab: Tab) => void;
    bottomInset?: number;
}

export const LiquidGlassTabBar: React.FC<LiquidGlassTabBarProps> = ({
    activeTab,
    onTabPress,
    bottomInset = 0,
}) => {
    const slideX = useSharedValue(activeTab === 'photos' ? 0 : TAB_WIDTH);

    useEffect(() => {
        slideX.value = withSpring(activeTab === 'photos' ? 0 : TAB_WIDTH, {
            damping: 18,
            stiffness: 200,
            mass: 0.6,
        });
    }, [activeTab]);

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: slideX.value }],
    }));

    const handlePress = (tab: Tab) => {
        if (tab !== activeTab) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTabPress(tab);
        }
    };

    return (
        <View style={[styles.wrapper, { bottom: Math.max(bottomInset + 2, 4) }]}>
            {/* Outer pill – blurred liquid glass */}
            <View style={styles.pill}>
                {/* Blur fills the pill */}
                <BlurView
                    intensity={Platform.OS === 'ios' ? 60 : 40}
                    tint="dark"
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Subtle inner border shimmer (top highlight) */}
                <View style={styles.innerBorder} pointerEvents="none" />

                {/* Sliding highlight – the active "bubble" inside the pill */}
                <Animated.View style={[styles.indicator, indicatorStyle]}>
                    <View style={styles.indicatorInner} />
                </Animated.View>

                {/* Tab buttons */}
                {TABS.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                        <TouchableWithoutFeedback key={tab.key} onPress={() => handlePress(tab.key)}>
                            <View style={styles.tab}>
                                <Ionicons
                                    name={isActive ? tab.iconActive : tab.icon as any}
                                    size={20}
                                    color={isActive ? '#ffffff' : 'rgba(255,255,255,0.5)'}
                                />
                                <Text style={[styles.label, isActive && styles.labelActive]}>
                                    {tab.label}
                                </Text>
                            </View>
                        </TouchableWithoutFeedback>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 20,
        // Pointer events pass through the wrapper so touches reach content below
        // but the pill itself will capture touches
    },
    pill: {
        width: PILL_WIDTH,
        height: PILL_HEIGHT,
        borderRadius: BORDER_RADIUS,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        // subtle dark base so the blur reads on all backgrounds
        backgroundColor: 'rgba(20, 20, 30, 0.35)',
        // Liquid glass border: faint top highlight + hairline all-around
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        // iOS shadow depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
        elevation: 14,
    },
    innerBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: BORDER_RADIUS,
        borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.28)',
        borderBottomColor: 'rgba(255,255,255,0.04)',
        borderLeftColor: 'rgba(255,255,255,0.1)',
        borderRightColor: 'rgba(255,255,255,0.1)',
        zIndex: 2,
    },
    indicator: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: TAB_WIDTH,
        padding: 5,
        zIndex: 1,
    },
    indicatorInner: {
        flex: 1,
        borderRadius: BORDER_RADIUS - 5,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        // Liquid glass spec: a faint inner top-edge glow
        borderWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.35)',
        borderBottomColor: 'rgba(255,255,255,0.05)',
        borderLeftColor: 'rgba(255,255,255,0.1)',
        borderRightColor: 'rgba(255,255,255,0.1)',
    },
    tab: {
        width: TAB_WIDTH,
        height: PILL_HEIGHT,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        zIndex: 3,
    },
    label: {
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 0.1,
    },
    labelActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
});

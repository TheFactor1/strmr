import React, { useRef, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface LockOverlayRef {
    lock: () => void;
}

interface LockOverlayProps {
    onHideControls: () => void;
    onShowControls: () => void;
}

const UNLOCK_BUTTON_VISIBLE_MS = 5000;

export const LockOverlay = forwardRef<LockOverlayRef, LockOverlayProps>(({ onHideControls, onShowControls }, ref) => {
    const [isLocked, setIsLocked] = useState(false);
    const isButtonVisibleRef = useRef(false);
    const buttonOpacity = useRef(new Animated.Value(0)).current;
    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

    const clearHideTimer = useCallback(() => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);

    const hideButton = useCallback(() => {
        isButtonVisibleRef.current = false;
        Animated.timing(buttonOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, [buttonOpacity]);

    const showButton = useCallback(() => {
        clearHideTimer();
        isButtonVisibleRef.current = true;
        Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
        hideTimerRef.current = setTimeout(hideButton, UNLOCK_BUTTON_VISIBLE_MS);
    }, [buttonOpacity, clearHideTimer, hideButton]);

    const lock = useCallback(() => {
        setIsLocked(true);
        onHideControls();
        showButton();
    }, [showButton, onHideControls]);

    const unlock = useCallback(() => {
        clearHideTimer();
        buttonOpacity.setValue(0);
        isButtonVisibleRef.current = false;
        setIsLocked(false);
        onShowControls();
    }, [buttonOpacity, clearHideTimer, onShowControls]);

    useImperativeHandle(ref, () => ({ lock }), [lock]);

    const handleScreenTap = useCallback(() => {
        if (isButtonVisibleRef.current) return;
        showButton();
    }, [showButton]);

    if (!isLocked) return null;

    return (
        <View style={styles.fullScreenBlocker}>
            <TouchableOpacity
                style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
                activeOpacity={1}
                onPress={handleScreenTap}
            />
            <Animated.View
                style={[styles.unlockButtonContainer, { opacity: buttonOpacity }]}
                pointerEvents="box-none"
            >
                <TouchableOpacity
                    style={styles.unlockButton}
                    activeOpacity={0.8}
                    onPress={unlock}
                >
                    <Ionicons name="lock-open-outline" size={20} color="white" />
                    <Text style={styles.unlockText}>Unlock</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
});

const styles = StyleSheet.create({
    fullScreenBlocker: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    unlockButtonContainer: {
        position: 'absolute',
        alignSelf: 'center',
    },
    unlockButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.70)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    unlockText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '600',
    },
});

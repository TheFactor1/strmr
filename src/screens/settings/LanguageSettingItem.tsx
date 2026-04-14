import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useBottomSheetBackHandler } from '../../hooks/useBottomSheetBackHandler';
import { ChevronRight, SettingItem } from './SettingsComponents';
import { LOCALES } from '../../constants/locales';

export interface LanguageOption {
    code: string;
    name: string;
}

interface LanguageSettingItemProps {
    title: string;
    value: string;
    onChange: (code: string) => void;
    languages?: LanguageOption[];
    isTablet?: boolean;
    isLast?: boolean;
}

export const LanguageSettingItem: React.FC<LanguageSettingItemProps> = ({
    title,
    value,
    onChange,
    languages,
    isTablet = false,
    isLast = false,
}) => {
    const { currentTheme } = useTheme();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);
    const { onChange: onSheetChange, onDismiss } = useBottomSheetBackHandler();

    const sortedLanguages = useMemo(() => {
        const sorted = [...(languages ?? LOCALES)].sort((a, b) => a.name.localeCompare(b.name));
        const selectedIndex = sorted.findIndex(l => l.code === value || l.code === value?.split('-')[0]);
        if (selectedIndex > 0) {
            const [selected] = sorted.splice(selectedIndex, 1);
            sorted.unshift(selected);
        }
        return sorted;
    }, [languages, value]);

    const currentLocale =
        sortedLanguages.find(l => l.code === value) ??
        sortedLanguages.find(l => l.code === value?.split('-')[0]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        ),
        []
    );

    return (
        <>
            <SettingItem
                title={title}
                description={currentLocale?.name}
                icon="globe"
                renderControl={() => <ChevronRight />}
                onPress={() => sheetRef.current?.present()}
                isLast={isLast}
                isTablet={isTablet}
            />

            <BottomSheetModal
                ref={sheetRef}
                index={0}
                snapPoints={['65%']}
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                backgroundStyle={{
                    backgroundColor: currentTheme.colors.darkGray || '#0A0C0C',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                }}
                handleIndicatorStyle={{
                    backgroundColor: currentTheme.colors.mediumGray,
                    width: 40,
                }}
                onChange={onSheetChange(sheetRef)}
                onDismiss={onDismiss(sheetRef)}
            >
                <View style={[styles.sheetHeader, { backgroundColor: currentTheme.colors.darkGray || '#0A0C0C' }]}>
                    <Text style={[styles.sheetTitle, { color: currentTheme.colors.white }]}>
                        {title}
                    </Text>
                    <TouchableOpacity onPress={() => sheetRef.current?.dismiss()}>
                        <Feather name="x" size={24} color={currentTheme.colors.lightGray} />
                    </TouchableOpacity>
                </View>
                <BottomSheetScrollView
                    style={{ backgroundColor: currentTheme.colors.darkGray || '#0A0C0C' }}
                    contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}
                >
                    {sortedLanguages.map(l => {
                        const isSelected = value === l.code || value?.split('-')[0] === l.code;
                        return (
                            <TouchableOpacity
                                key={l.code}
                                style={[
                                    styles.languageOption,
                                    isSelected && { backgroundColor: currentTheme.colors.primary + '20' },
                                ]}
                                onPress={() => {
                                    onChange(l.code);
                                    sheetRef.current?.dismiss();
                                }}
                            >
                                <Text style={[
                                    styles.languageName,
                                    { color: isSelected ? currentTheme.colors.primary : currentTheme.colors.highEmphasis },
                                    isSelected && { fontWeight: 'bold' },
                                ]}>
                                    {l.name}
                                </Text>
                                <Text style={[styles.languageCode, { color: currentTheme.colors.mediumEmphasis }]}>
                                    {l.code.toUpperCase()}
                                </Text>
                                {isSelected && (
                                    <Feather name="check" size={20} color={currentTheme.colors.primary} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </BottomSheetScrollView>
            </BottomSheetModal>
        </>
    );
};

const styles = StyleSheet.create({
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    sheetContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24,
    },
    languageOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    languageName: {
        flex: 1,
        fontSize: 16,
    },
    languageCode: {
        fontSize: 12,
        marginRight: 8,
    },
});

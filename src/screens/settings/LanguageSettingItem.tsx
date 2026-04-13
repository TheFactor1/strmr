import React, { useCallback, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useBottomSheetBackHandler } from '../../hooks/useBottomSheetBackHandler';
import { ChevronRight, SettingItem } from './SettingsComponents';
import { LOCALES } from '../../constants/locales';

const SORTED_LOCALES = [...LOCALES].sort((a, b) => a.name.localeCompare(b.name));

interface LanguageSettingItemProps {
    isTablet?: boolean;
    isLast?: boolean;
}

export const LanguageSettingItem: React.FC<LanguageSettingItemProps> = ({ isTablet = false, isLast = false }) => {
    const { t, i18n } = useTranslation();
    const { currentTheme } = useTheme();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);
    const { onChange, onDismiss } = useBottomSheetBackHandler();

    const currentLocale =
        LOCALES.find(l => l.code === i18n.language) ??
        LOCALES.find(l => l.code === i18n.language?.split('-')[0]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        ),
        []
    );

    return (
        <>
            <SettingItem
                title={t('settings.language')}
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
                onChange={onChange(sheetRef)}
                onDismiss={onDismiss(sheetRef)}
            >
                <View style={[styles.sheetHeader, { backgroundColor: currentTheme.colors.darkGray || '#0A0C0C' }]}>
                    <Text style={[styles.sheetTitle, { color: currentTheme.colors.white }]}>
                        {t('settings.select_language')}
                    </Text>
                    <TouchableOpacity onPress={() => sheetRef.current?.dismiss()}>
                        <Feather name="x" size={24} color={currentTheme.colors.lightGray} />
                    </TouchableOpacity>
                </View>
                <BottomSheetScrollView
                    style={{ backgroundColor: currentTheme.colors.darkGray || '#0A0C0C' }}
                    contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}
                >
                    {SORTED_LOCALES.map(l => {
                        const isSelected = i18n.language === l.code ||
                            i18n.language?.split('-')[0] === l.code;
                        return (
                            <TouchableOpacity
                                key={l.code}
                                style={[
                                    styles.languageOption,
                                    isSelected && { backgroundColor: currentTheme.colors.primary + '20' },
                                ]}
                                onPress={() => {
                                    i18n.changeLanguage(l.code);
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

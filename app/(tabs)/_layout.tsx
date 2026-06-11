import { Platform } from 'react-native';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

const androidTabProps = Platform.select({
  android: {
    backgroundColor: '#FDF8F3',
    iconColor: { default: '#6B5A53', selected: '#7D5A4F' },
    labelStyle: {
      default: { color: '#6B5A53' as const },
      selected: { color: '#7D5A4F' as const },
    },
    indicatorColor: '#F5EDE3',
    rippleColor: 'rgba(125, 90, 79, 0.12)',
  },
  default: {},
});

export default function TabLayout() {
  return (
    <NativeTabs {...androidTabProps}>
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          androidSrc={<VectorIcon family={Ionicons} name="home-outline" />}
        />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analysis">
        <Icon
          sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
          androidSrc={<VectorIcon family={Ionicons} name="bar-chart-outline" />}
        />
        <Label>Analysis</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          androidSrc={<VectorIcon family={Ionicons} name="settings-outline" />}
        />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

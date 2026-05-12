import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function TabLayout() {
  return (
    <NativeTabs>
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

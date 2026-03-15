import type { ComponentNode } from '../types/mokkoi'

export const loginScreenTree: ComponentNode = {
  type: 'SafeAreaView',
  style: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  children: [
    {
      type: 'ScrollView',
      props: {
        contentContainerStyle: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 28,
          paddingVertical: 40,
        },
      },
      children: [
        // Logo area
        {
          type: 'View',
          style: {
            alignItems: 'center',
            marginBottom: 40,
          },
          children: [
            {
              type: 'View',
              style: {
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: '#818CF8',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              },
              children: [
                {
                  type: 'Text',
                  style: {
                    fontSize: 24,
                    fontWeight: '700',
                    color: '#FFFFFF',
                  },
                  children: ['M'],
                },
              ],
            },
            {
              type: 'Text',
              style: {
                fontSize: 22,
                fontWeight: '700',
                color: '#F8FAFC',
                marginBottom: 6,
              },
              children: ['Welcome back'],
            },
            {
              type: 'Text',
              style: {
                fontSize: 14,
                color: '#94A3B8',
              },
              children: ['Sign in to your account'],
            },
          ],
        },

        // Email field
        {
          type: 'View',
          style: { marginBottom: 16 },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 13,
                fontWeight: '500',
                color: '#94A3B8',
                marginBottom: 8,
              },
              children: ['Email'],
            },
            {
              type: 'TextInput',
              props: {
                placeholder: 'you@example.com',
                placeholderTextColor: '#475569',
                keyboardType: 'email-address',
                autoCapitalize: 'none',
              },
              style: {
                height: 44,
                backgroundColor: '#1E293B',
                borderRadius: 10,
                paddingHorizontal: 14,
                fontSize: 14,
                color: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#334155',
              },
            },
          ],
        },

        // Password field
        {
          type: 'View',
          style: { marginBottom: 8 },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 13,
                fontWeight: '500',
                color: '#94A3B8',
                marginBottom: 8,
              },
              children: ['Password'],
            },
            {
              type: 'TextInput',
              props: {
                placeholder: '••••••••',
                placeholderTextColor: '#475569',
                secureTextEntry: true,
              },
              style: {
                height: 44,
                backgroundColor: '#1E293B',
                borderRadius: 10,
                paddingHorizontal: 14,
                fontSize: 14,
                color: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#334155',
              },
            },
          ],
        },

        // Forgot password
        {
          type: 'TouchableOpacity',
          style: {
            alignSelf: 'flex-end',
            marginBottom: 24,
            paddingVertical: 4,
          },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 13,
                color: '#818CF8',
                fontWeight: '500',
              },
              children: ['Forgot password?'],
            },
          ],
        },

        // Sign in button
        {
          type: 'TouchableOpacity',
          style: {
            height: 46,
            backgroundColor: '#818CF8',
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 15,
                fontWeight: '600',
                color: '#FFFFFF',
              },
              children: ['Sign In'],
            },
          ],
        },

        // Divider
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 20,
          },
          children: [
            {
              type: 'View',
              style: { flex: 1, height: 1, backgroundColor: '#1E293B' },
            },
            {
              type: 'Text',
              style: {
                fontSize: 12,
                color: '#64748B',
                paddingHorizontal: 12,
              },
              children: ['or continue with'],
            },
            {
              type: 'View',
              style: { flex: 1, height: 1, backgroundColor: '#1E293B' },
            },
          ],
        },

        // Social buttons row
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 32,
          },
          children: [
            {
              type: 'TouchableOpacity',
              style: {
                flex: 1,
                height: 44,
                backgroundColor: '#1E293B',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#F8FAFC', fontWeight: '500' },
                  children: ['Google'],
                },
              ],
            },
            {
              type: 'TouchableOpacity',
              style: {
                flex: 1,
                height: 44,
                backgroundColor: '#1E293B',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#F8FAFC', fontWeight: '500' },
                  children: ['Apple'],
                },
              ],
            },
          ],
        },

        // Sign up link
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 4,
          },
          children: [
            {
              type: 'Text',
              style: { fontSize: 13, color: '#94A3B8' },
              children: ["Don't have an account?"],
            },
            {
              type: 'TouchableOpacity',
              children: [
                {
                  type: 'Text',
                  style: {
                    fontSize: 13,
                    color: '#818CF8',
                    fontWeight: '600',
                  },
                  children: ['Sign Up'],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

export const homeScreenTree: ComponentNode = {
  type: 'SafeAreaView',
  style: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  children: [
    {
      type: 'ScrollView',
      props: {
        contentContainerStyle: {
          paddingHorizontal: 20,
          paddingVertical: 24,
        },
      },
      children: [
        // Header
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 28,
          },
          children: [
            {
              type: 'View',
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 13, color: '#94A3B8', marginBottom: 2 },
                  children: ['Good morning'],
                },
                {
                  type: 'Text',
                  style: { fontSize: 20, fontWeight: '700', color: '#F8FAFC' },
                  children: ['Alex'],
                },
              ],
            },
            {
              type: 'View',
              style: {
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#818CF8',
                alignItems: 'center',
                justifyContent: 'center',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
                  children: ['S'],
                },
              ],
            },
          ],
        },

        // Stats cards
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 24,
          },
          children: [
            {
              type: 'View',
              style: {
                flex: 1,
                backgroundColor: '#1E293B',
                borderRadius: 14,
                padding: 16,
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
                  children: ['Tasks'],
                },
                {
                  type: 'Text',
                  style: { fontSize: 24, fontWeight: '700', color: '#F8FAFC' },
                  children: ['12'],
                },
                {
                  type: 'Text',
                  style: { fontSize: 11, color: '#34D399' },
                  children: ['+3 today'],
                },
              ],
            },
            {
              type: 'View',
              style: {
                flex: 1,
                backgroundColor: '#1E293B',
                borderRadius: 14,
                padding: 16,
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
                  children: ['Streak'],
                },
                {
                  type: 'Text',
                  style: { fontSize: 24, fontWeight: '700', color: '#F8FAFC' },
                  children: ['7d'],
                },
                {
                  type: 'Text',
                  style: { fontSize: 11, color: '#FBBF24' },
                  children: ['Personal best!'],
                },
              ],
            },
          ],
        },

        // Recent section
        {
          type: 'Text',
          style: {
            fontSize: 15,
            fontWeight: '600',
            color: '#F8FAFC',
            marginBottom: 12,
          },
          children: ['Recent Activity'],
        },

        // Activity items
        ...[
          { title: 'Design review completed', time: '2m ago', color: '#34D399' },
          { title: 'New comment on PR #42', time: '15m ago', color: '#818CF8' },
          { title: 'Build succeeded', time: '1h ago', color: '#34D399' },
        ].map((item): ComponentNode => ({
          type: 'View',
          style: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1E293B',
            borderRadius: 12,
            padding: 14,
            marginBottom: 8,
            gap: 12,
          },
          children: [
            {
              type: 'View',
              style: {
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: item.color,
              },
            },
            {
              type: 'View',
              style: { flex: 1 },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 13, color: '#F8FAFC', fontWeight: '500' },
                  children: [item.title],
                },
                {
                  type: 'Text',
                  style: { fontSize: 11, color: '#64748B', marginTop: 2 },
                  children: [item.time],
                },
              ],
            },
          ],
        })),
      ],
    },
  ],
}

export const profileScreenTree: ComponentNode = {
  type: 'SafeAreaView',
  style: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  children: [
    {
      type: 'ScrollView',
      props: {
        contentContainerStyle: {
          alignItems: 'center',
          paddingVertical: 32,
          paddingHorizontal: 20,
        },
      },
      children: [
        // Avatar
        {
          type: 'View',
          style: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#818CF8',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          },
          children: [
            {
              type: 'Text',
              style: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
              children: ['S'],
            },
          ],
        },
        {
          type: 'Text',
          style: { fontSize: 18, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
          children: ['Alex Turner'],
        },
        {
          type: 'Text',
          style: { fontSize: 13, color: '#94A3B8', marginBottom: 28 },
          children: ['alex@mokkoi.dev'],
        },

        // Stats row
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            gap: 24,
            marginBottom: 28,
          },
          children: [
            ...[
              { label: 'Projects', value: '8' },
              { label: 'Screens', value: '24' },
              { label: 'Tokens', value: '156' },
            ].map((stat): ComponentNode => ({
              type: 'View',
              style: { alignItems: 'center' },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 20, fontWeight: '700', color: '#F8FAFC' },
                  children: [stat.value],
                },
                {
                  type: 'Text',
                  style: { fontSize: 11, color: '#64748B', marginTop: 2 },
                  children: [stat.label],
                },
              ],
            })),
          ],
        },

        // Menu items
        ...[
          'Edit Profile',
          'Notifications',
          'Privacy',
          'Help & Support',
          'Log Out',
        ].map((label): ComponentNode => ({
          type: 'TouchableOpacity',
          style: {
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1E293B',
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 16,
            marginBottom: 8,
          },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 14,
                color: label === 'Log Out' ? '#F87171' : '#F8FAFC',
                fontWeight: '500',
              },
              children: [label],
            },
            {
              type: 'Text',
              style: { fontSize: 16, color: '#64748B' },
              children: ['\u203A'],
            },
          ],
        })),
      ],
    },
  ],
}

export const MOCK_SCREEN_TREES: Record<string, ComponentNode> = {
  HomeScreen: homeScreenTree,
  ProfileScreen: profileScreenTree,
  SettingsScreen: loginScreenTree, // Use login screen for settings demo slot
}

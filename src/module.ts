import { AppPlugin, PluginExtensionPanelContext, PluginExtensionPoints } from '@grafana/data';
import React from 'react';
import { AppConfig } from './components/AppConfig';
import { AnalyzePage } from './pages';
import { PanelAnalysisModal, ExploreAnalysisModal } from './extensions/AnalysisModal';
import { PLUGIN_ID } from './constants';

export const plugin = new AppPlugin<{}>()
  .setRootPage(AnalyzePage)
  .addConfigPage({
    title: 'Configuration',
    icon: 'cog',
    body: AppConfig,
    id: 'configuration',
  })
  .addLink({
    title: 'Analyze with LLM',
    description: 'Send this panel to AI for analysis',
    targets: [PluginExtensionPoints.DashboardPanelMenu],
    configure: (context) => {
      return {
        icon: 'ai' as const,
        category: 'LLM',
        onClick: (event, helpers) => {
          const panelContext = helpers?.context as PluginExtensionPanelContext | undefined;
          if (helpers?.openModal) {
            helpers.openModal({
              title: '🤖 Analyze Panel with LLM',
              body: ({ onDismiss }) =>
                React.createElement(PanelAnalysisModal, { context: panelContext, onDismiss }),
              width: '60%',
              height: '80vh',
            });
          }
        },
      };
    },
  })
  .addLink({
    title: 'Analyze with LLM',
    description: 'Analyze current query results with AI',
    targets: [PluginExtensionPoints.ExploreToolbarAction],
    configure: () => {
      return {
        icon: 'ai' as const,
        onClick: (_event, helpers) => {
          if (helpers?.openModal) {
            helpers.openModal({
              title: '🤖 Analyze with LLM',
              body: ({ onDismiss }) => React.createElement(ExploreAnalysisModal, { onDismiss }),
              width: '60%',
              height: '80vh',
            });
          }
        },
      };
    },
  })
  .addLink({
    title: 'LLM Analysis',
    description: 'Open LLM Analysis page',
    targets: [PluginExtensionPoints.CommandPalette],
    configure: () => {
      return {
        path: `/a/${PLUGIN_ID}`,
        icon: 'ai' as const,
      };
    },
  });

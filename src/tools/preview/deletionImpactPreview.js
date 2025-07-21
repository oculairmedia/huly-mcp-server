import { isValidIssueIdentifier } from '../../utils/validators.js';

export const definition = {
  name: 'huly_deletion_impact_preview',
  description:
    'Preview the full impact of a deletion operation, including all affected entities and dependencies',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['issue', 'project', 'component', 'milestone'],
        description: 'Type of entity to preview deletion for',
      },
      entity_identifier: {
        type: 'string',
        description: 'Entity identifier (e.g., "PROJ-123" for issue, "PROJ" for project)',
      },
      project_identifier: {
        type: 'string',
        description: 'Project identifier (required for component/milestone preview)',
      },
      cascade: {
        type: 'boolean',
        default: true,
        description: 'Preview cascade deletion of sub-issues (for issues only)',
      },
      detailed: {
        type: 'boolean',
        default: false,
        description: 'Include detailed information about each affected entity',
      },
    },
    required: ['entity_type', 'entity_identifier'],
  },
};

export async function handler(args, context) {
  const { client, services, logger } = context;
  const { deletionService } = services;
  const {
    entity_type,
    entity_identifier,
    project_identifier,
    cascade = true,
    detailed = false,
  } = args;

  try {
    let preview;

    switch (entity_type) {
      case 'issue': {
        if (!isValidIssueIdentifier(entity_identifier)) {
          throw new Error(`Invalid issue identifier format: ${entity_identifier}`);
        }
        preview = await previewIssueImpact(
          client,
          deletionService,
          entity_identifier,
          cascade,
          detailed
        );
        break;
      }

      case 'project': {
        preview = await previewProjectImpact(client, deletionService, entity_identifier, detailed);
        break;
      }

      case 'component': {
        if (!project_identifier) {
          throw new Error('project_identifier is required for component preview');
        }
        preview = await previewComponentImpact(
          client,
          deletionService,
          project_identifier,
          entity_identifier,
          detailed
        );
        break;
      }

      case 'milestone': {
        if (!project_identifier) {
          throw new Error('project_identifier is required for milestone preview');
        }
        preview = await previewMilestoneImpact(
          client,
          deletionService,
          project_identifier,
          entity_identifier,
          detailed
        );
        break;
      }

      default:
        throw new Error(`Unknown entity type: ${entity_type}`);
    }

    return formatPreview(preview, entity_type, entity_identifier);
  } catch (error) {
    logger.error('Error previewing deletion impact:', error);
    throw error;
  }
}

async function previewIssueImpact(client, deletionService, issueIdentifier, cascade, detailed) {
  const validation = await deletionService.validateIssueDelete(client, issueIdentifier);

  if (!validation.canDelete && !validation.warnings?.length) {
    return {
      directImpact: 0,
      cascadeImpact: 0,
      totalImpact: 0,
      affectedEntities: {},
      validation,
    };
  }

  const impact = {
    directImpact: 1,
    cascadeImpact: 0,
    totalImpact: 1,
    affectedEntities: {
      issues: [issueIdentifier],
    },
    validation,
  };

  if (cascade && validation.dependencies?.subIssues?.length > 0) {
    impact.cascadeImpact = validation.dependencies.subIssues.length;
    impact.totalImpact += impact.cascadeImpact;
    impact.affectedEntities.subIssues = validation.dependencies.subIssues.map(
      (sub) => sub.identifier
    );

    if (detailed) {
      impact.affectedEntities.subIssueDetails = validation.dependencies.subIssues;
    }
  }

  if (validation.dependencies?.comments?.length > 0) {
    impact.affectedEntities.comments = validation.dependencies.comments.length;
  }

  if (validation.dependencies?.attachments?.length > 0) {
    impact.affectedEntities.attachments = validation.dependencies.attachments.length;
  }

  return impact;
}

async function previewProjectImpact(client, deletionService, projectIdentifier, detailed) {
  const validation = await deletionService.validateProjectDelete(client, projectIdentifier);

  const impact = {
    directImpact: 1,
    cascadeImpact: 0,
    totalImpact: 1,
    affectedEntities: {
      projects: [projectIdentifier],
    },
    validation,
  };

  // Calculate cascade impact
  const cascadeCount =
    (validation.impact?.issues || 0) +
    (validation.impact?.components || 0) +
    (validation.impact?.milestones || 0) +
    (validation.impact?.templates || 0);

  impact.cascadeImpact = cascadeCount;
  impact.totalImpact += cascadeCount;

  if (validation.impact?.issues > 0) {
    impact.affectedEntities.issues = validation.impact.issues;
    if (detailed && validation.dependencies?.issues) {
      impact.affectedEntities.issueDetails = validation.dependencies.issues;
    }
  }

  if (validation.impact?.components > 0) {
    impact.affectedEntities.components = validation.impact.components;
    if (detailed && validation.dependencies?.components) {
      impact.affectedEntities.componentDetails = validation.dependencies.components;
    }
  }

  if (validation.impact?.milestones > 0) {
    impact.affectedEntities.milestones = validation.impact.milestones;
    if (detailed && validation.dependencies?.milestones) {
      impact.affectedEntities.milestoneDetails = validation.dependencies.milestones;
    }
  }

  if (validation.impact?.templates > 0) {
    impact.affectedEntities.templates = validation.impact.templates;
    if (detailed && validation.dependencies?.templates) {
      impact.affectedEntities.templateDetails = validation.dependencies.templates;
    }
  }

  return impact;
}

async function previewComponentImpact(
  client,
  deletionService,
  projectIdentifier,
  componentLabel,
  detailed
) {
  const validation = await deletionService.validateComponentDelete(
    client,
    projectIdentifier,
    componentLabel
  );

  const impact = {
    directImpact: 1,
    cascadeImpact: validation.impact?.issues || 0,
    totalImpact: 1 + (validation.impact?.issues || 0),
    affectedEntities: {
      components: [`${projectIdentifier}/${componentLabel}`],
    },
    validation,
  };

  if (validation.impact?.issues > 0) {
    impact.affectedEntities.issues = validation.impact.issues;
    if (detailed && validation.dependencies?.issues) {
      impact.affectedEntities.issueDetails = validation.dependencies.issues.map((issue) => ({
        identifier: issue.identifier,
        title: issue.title,
        status: issue.status,
      }));
    }
  }

  return impact;
}

async function previewMilestoneImpact(
  client,
  deletionService,
  projectIdentifier,
  milestoneLabel,
  detailed
) {
  const validation = await deletionService.validateMilestoneDelete(
    client,
    projectIdentifier,
    milestoneLabel
  );

  const impact = {
    directImpact: 1,
    cascadeImpact: validation.impact?.issues || 0,
    totalImpact: 1 + (validation.impact?.issues || 0),
    affectedEntities: {
      milestones: [`${projectIdentifier}/${milestoneLabel}`],
    },
    validation,
  };

  if (validation.impact?.issues > 0) {
    impact.affectedEntities.issues = validation.impact.issues;
    if (detailed && validation.dependencies?.issues) {
      impact.affectedEntities.issueDetails = validation.dependencies.issues.map((issue) => ({
        identifier: issue.identifier,
        title: issue.title,
        status: issue.status,
        targetDate: validation.dependencies.milestoneInfo?.targetDate,
      }));
    }
  }

  return impact;
}

function formatPreview(preview, entityType, entityIdentifier) {
  const { directImpact, cascadeImpact, totalImpact, affectedEntities, validation } = preview;

  let output = `# Deletion Impact Preview\n\n`;
  output += `**Entity**: ${entityType} - ${entityIdentifier}\n`;
  if (validation.name) {
    output += `**Name**: ${validation.name}\n`;
  }
  output += `\n`;

  // Impact summary
  output += `## 📊 Impact Summary\n\n`;
  output += `- **Direct Impact**: ${directImpact} ${entityType}${directImpact !== 1 ? 's' : ''}\n`;
  output += `- **Cascade Impact**: ${cascadeImpact} related entities\n`;
  output += `- **Total Impact**: ${totalImpact} entities\n\n`;

  // Show if deletion is blocked
  if (!validation.canDelete) {
    output += `## ❌ Deletion Blocked\n\n`;
    if (validation.blockers?.length > 0) {
      output += `**Blockers:**\n`;
      validation.blockers.forEach((blocker) => {
        output += `- ${blocker}\n`;
      });
      output += `\n`;
    }
  }

  // Affected entities breakdown
  if (
    Object.keys(affectedEntities).length > 1 ||
    affectedEntities[Object.keys(affectedEntities)[0]] !== 1
  ) {
    output += `## 🔗 Affected Entities\n\n`;

    // Issues
    if (affectedEntities.issues) {
      if (Array.isArray(affectedEntities.issues)) {
        output += `**Issues** (${affectedEntities.issues.length}):\n`;
        affectedEntities.issues.forEach((issue) => {
          output += `- ${issue}\n`;
        });
      } else {
        output += `**Issues**: ${affectedEntities.issues}\n`;
      }

      if (affectedEntities.issueDetails) {
        output += `\n<details>\n<summary>Issue Details</summary>\n\n`;
        affectedEntities.issueDetails.forEach((issue) => {
          output += `- **${issue.identifier}**: ${issue.title} (${issue.status})\n`;
        });
        output += `\n</details>\n`;
      }
      output += `\n`;
    }

    // Sub-issues
    if (affectedEntities.subIssues) {
      output += `**Sub-issues** (${affectedEntities.subIssues.length}):\n`;
      affectedEntities.subIssues.forEach((subIssue) => {
        output += `- ${subIssue}\n`;
      });

      if (affectedEntities.subIssueDetails) {
        output += `\n<details>\n<summary>Sub-issue Details</summary>\n\n`;
        affectedEntities.subIssueDetails.forEach((issue) => {
          output += `- **${issue.identifier}**: ${issue.title} (${issue.status})\n`;
        });
        output += `\n</details>\n`;
      }
      output += `\n`;
    }

    // Components
    if (affectedEntities.components) {
      if (Array.isArray(affectedEntities.components)) {
        output += `**Components** (${affectedEntities.components.length}):\n`;
        affectedEntities.components.forEach((component) => {
          output += `- ${component}\n`;
        });
      } else {
        output += `**Components**: ${affectedEntities.components}\n`;
      }

      if (affectedEntities.componentDetails) {
        output += `\n<details>\n<summary>Component Details</summary>\n\n`;
        affectedEntities.componentDetails.forEach((component) => {
          output += `- **${component.label}**: ${component.description || 'No description'}\n`;
        });
        output += `\n</details>\n`;
      }
      output += `\n`;
    }

    // Milestones
    if (affectedEntities.milestones) {
      if (Array.isArray(affectedEntities.milestones)) {
        output += `**Milestones** (${affectedEntities.milestones.length}):\n`;
        affectedEntities.milestones.forEach((milestone) => {
          output += `- ${milestone}\n`;
        });
      } else {
        output += `**Milestones**: ${affectedEntities.milestones}\n`;
      }

      if (affectedEntities.milestoneDetails) {
        output += `\n<details>\n<summary>Milestone Details</summary>\n\n`;
        affectedEntities.milestoneDetails.forEach((milestone) => {
          output += `- **${milestone.label}**: ${milestone.description || 'No description'} (${milestone.status})\n`;
        });
        output += `\n</details>\n`;
      }
      output += `\n`;
    }

    // Templates
    if (affectedEntities.templates) {
      output += `**Templates**: ${affectedEntities.templates}\n`;

      if (affectedEntities.templateDetails) {
        output += `\n<details>\n<summary>Template Details</summary>\n\n`;
        affectedEntities.templateDetails.forEach((template) => {
          output += `- **${template.title}**\n`;
        });
        output += `\n</details>\n`;
      }
      output += `\n`;
    }

    // Comments and attachments
    if (affectedEntities.comments) {
      output += `**Comments**: ${affectedEntities.comments}\n`;
    }
    if (affectedEntities.attachments) {
      output += `**Attachments**: ${affectedEntities.attachments}\n`;
    }
  }

  // Warnings
  if (validation.warnings?.length > 0) {
    output += `## ⚠️ Warnings\n\n`;
    validation.warnings.forEach((warning) => {
      output += `- ${warning}\n`;
    });
    output += `\n`;
  }

  // Recommendation
  output += `## 💡 Recommendation\n\n`;
  if (!validation.canDelete) {
    output += `This ${entityType} cannot be deleted due to blockers. `;
    output += `Resolve the blockers first or use the force option to override.\n`;
  } else if (totalImpact > 10) {
    output += `This deletion will affect ${totalImpact} entities. `;
    output += `Review the impact carefully before proceeding.\n`;
  } else if (cascadeImpact > 0) {
    output += `This deletion will cascade to ${cascadeImpact} related entities. `;
    output += `Ensure this is intentional before proceeding.\n`;
  } else {
    output += `This deletion has minimal impact and can proceed safely.\n`;
  }

  return output;
}

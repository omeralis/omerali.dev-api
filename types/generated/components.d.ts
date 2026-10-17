import type { Schema, Struct } from '@strapi/strapi';

export interface PortfolioActions extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_actions';
  info: {
    displayName: 'actions';
  };
  attributes: {
    contact: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    projects: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    resume: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    unavailable: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
  };
}

export interface PortfolioArchitecture extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_architecture';
  info: {
    displayName: 'architecture';
  };
  attributes: {
    caption: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    heading: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    layers: Schema.Attribute.Component<'portfolio.layer', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface PortfolioContact extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_contact';
  info: {
    displayName: 'contact';
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    caption: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    email: Schema.Attribute.Email;
    heading: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    identifier: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    introduction: Schema.Attribute.Text & Schema.Attribute.Required;
    location: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
  };
}

export interface PortfolioDetail extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_detail';
  info: {
    displayName: 'detail';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    value: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

export interface PortfolioHero extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_hero';
  info: {
    displayName: 'hero';
  };
  attributes: {
    actions: Schema.Attribute.Component<'portfolio.actions', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    architecture: Schema.Attribute.Component<'portfolio.architecture', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    headline: Schema.Attribute.Component<'portfolio.text', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    identity: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    introduction: Schema.Attribute.Text & Schema.Attribute.Required;
    metrics: Schema.Attribute.Component<'portfolio.metrics', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface PortfolioLayer extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_layer';
  info: {
    displayName: 'layer';
  };
  attributes: {
    detail: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
  };
}

export interface PortfolioMetrics extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_metrics';
  info: {
    displayName: 'metrics';
  };
  attributes: {
    based: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    experience: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    location: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    since: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    start: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
  };
}

export interface PortfolioSkill extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_skill';
  info: {
    displayName: 'skill';
  };
  attributes: {
    primary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    technology: Schema.Attribute.Relation<
      'manyToOne',
      'api::technology.technology'
    >;
  };
}

export interface PortfolioSkillGroup extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_skill_group';
  info: {
    displayName: 'skill-group';
  };
  attributes: {
    category: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    items: Schema.Attribute.Component<'portfolio.skill', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
  };
}

export interface PortfolioSocialLink extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_social_link';
  info: {
    displayName: 'social-link';
  };
  attributes: {
    displayOrder: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    key: Schema.Attribute.Enumeration<['linkedin', 'github', 'other']> &
      Schema.Attribute.Required;
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    url: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
  };
}

export interface PortfolioText extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_text';
  info: {
    displayName: 'text';
  };
  attributes: {
    value: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

export interface ProjectFeature extends Struct.ComponentSchema {
  collectionName: 'components_project_features';
  info: {
    displayName: 'Project Feature';
  };
  attributes: {
    description: Schema.Attribute.Text;
    displayOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ProjectResponsibility extends Struct.ComponentSchema {
  collectionName: 'components_project_responsibilities';
  info: {
    displayName: 'Project Responsibility';
  };
  attributes: {
    description: Schema.Attribute.Text & Schema.Attribute.Required;
    displayOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface ProjectSeo extends Struct.ComponentSchema {
  collectionName: 'components_project_seos';
  info: {
    displayName: 'Project SEO';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text;
    metaTitle: Schema.Attribute.String;
    ogImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface SharedQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_quotes';
  info: {
    displayName: 'Quote';
    icon: 'indent';
  };
  attributes: {
    body: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'Seo';
    icon: 'allergies';
    name: 'Seo';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedSlider extends Struct.ComponentSchema {
  collectionName: 'components_shared_sliders';
  info: {
    description: '';
    displayName: 'Slider';
    icon: 'address-book';
  };
  attributes: {
    files: Schema.Attribute.Media<'images', true>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'portfolio.actions': PortfolioActions;
      'portfolio.architecture': PortfolioArchitecture;
      'portfolio.contact': PortfolioContact;
      'portfolio.detail': PortfolioDetail;
      'portfolio.hero': PortfolioHero;
      'portfolio.layer': PortfolioLayer;
      'portfolio.metrics': PortfolioMetrics;
      'portfolio.skill': PortfolioSkill;
      'portfolio.skill-group': PortfolioSkillGroup;
      'portfolio.social-link': PortfolioSocialLink;
      'portfolio.text': PortfolioText;
      'project.feature': ProjectFeature;
      'project.responsibility': ProjectResponsibility;
      'project.seo': ProjectSeo;
      'shared.media': SharedMedia;
      'shared.quote': SharedQuote;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.slider': SharedSlider;
    }
  }
}

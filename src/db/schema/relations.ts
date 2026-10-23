import { relations } from 'drizzle-orm';
import { users } from './auth';
import { clientConfidential, clientPeople, clients } from './clients';
import { areas, features, media } from './content';
import {
  listingBusiness,
  listingConfidential,
  listingDisclosures,
  listingFeatures,
  listingLeaseTerms,
  listingOwnership,
  listingPhotos,
  listingPropertyDetails,
  listingReviews,
  listingRevisions,
  listings,
  listingTerms,
  priceHistory,
} from './listings';
import { agentProfiles } from './staff';

export const usersRelations = relations(users, ({ one }) => ({
  agentProfile: one(agentProfiles, { fields: [users.id], references: [agentProfiles.userId] }),
}));

export const agentProfilesRelations = relations(agentProfiles, ({ one }) => ({
  user: one(users, { fields: [agentProfiles.userId], references: [users.id] }),
  photo: one(media, { fields: [agentProfiles.photoId], references: [media.id] }),
}));

export const areasRelations = relations(areas, ({ one, many }) => ({
  parent: one(areas, { fields: [areas.parentId], references: [areas.id], relationName: 'area_parent' }),
  children: many(areas, { relationName: 'area_parent' }),
  hero: one(media, { fields: [areas.heroMediaId], references: [media.id] }),
  listings: many(listings),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  people: many(clientPeople),
  confidential: one(clientConfidential, { fields: [clients.id], references: [clientConfidential.clientId] }),
  user: one(users, { fields: [clients.userId], references: [users.id], relationName: 'client_user' }),
  agent: one(users, { fields: [clients.agentId], references: [users.id], relationName: 'client_agent' }),
  listings: many(listings),
}));

export const clientPeopleRelations = relations(clientPeople, ({ one }) => ({
  client: one(clients, { fields: [clientPeople.clientId], references: [clients.id] }),
}));

export const clientConfidentialRelations = relations(clientConfidential, ({ one }) => ({
  client: one(clients, { fields: [clientConfidential.clientId], references: [clients.id] }),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  area: one(areas, { fields: [listings.areaId], references: [areas.id] }),
  agent: one(users, { fields: [listings.listingAgentId], references: [users.id], relationName: 'listing_agent' }),
  submitter: one(users, { fields: [listings.submittedByUserId], references: [users.id], relationName: 'listing_submitter' }),
  seller: one(clients, { fields: [listings.sellerClientId], references: [clients.id] }),
  photos: many(listingPhotos),
  features: many(listingFeatures),
  reviews: many(listingReviews),
  revisions: many(listingRevisions),
  priceHistory: many(priceHistory),
  details: one(listingPropertyDetails, { fields: [listings.id], references: [listingPropertyDetails.listingId] }),
  ownership: one(listingOwnership, { fields: [listings.id], references: [listingOwnership.listingId] }),
  terms: one(listingTerms, { fields: [listings.id], references: [listingTerms.listingId] }),
  lease: one(listingLeaseTerms, { fields: [listings.id], references: [listingLeaseTerms.listingId] }),
  business: one(listingBusiness, { fields: [listings.id], references: [listingBusiness.listingId] }),
  disclosures: many(listingDisclosures),
  confidential: one(listingConfidential, { fields: [listings.id], references: [listingConfidential.listingId] }),
}));

export const listingPhotosRelations = relations(listingPhotos, ({ one }) => ({
  listing: one(listings, { fields: [listingPhotos.listingId], references: [listings.id] }),
  media: one(media, { fields: [listingPhotos.mediaId], references: [media.id] }),
}));

export const listingFeaturesRelations = relations(listingFeatures, ({ one }) => ({
  listing: one(listings, { fields: [listingFeatures.listingId], references: [listings.id] }),
  feature: one(features, { fields: [listingFeatures.featureId], references: [features.id] }),
}));

export const listingReviewsRelations = relations(listingReviews, ({ one }) => ({
  listing: one(listings, { fields: [listingReviews.listingId], references: [listings.id] }),
  submitter: one(users, { fields: [listingReviews.submittedBy], references: [users.id], relationName: 'review_submitter' }),
  reviewer: one(users, { fields: [listingReviews.reviewerId], references: [users.id], relationName: 'review_reviewer' }),
}));

export const listingRevisionsRelations = relations(listingRevisions, ({ one }) => ({
  listing: one(listings, { fields: [listingRevisions.listingId], references: [listings.id] }),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  listing: one(listings, { fields: [priceHistory.listingId], references: [listings.id] }),
}));

export const listingPropertyDetailsRelations = relations(listingPropertyDetails, ({ one }) => ({
  listing: one(listings, { fields: [listingPropertyDetails.listingId], references: [listings.id] }),
}));

export const listingOwnershipRelations = relations(listingOwnership, ({ one }) => ({
  listing: one(listings, { fields: [listingOwnership.listingId], references: [listings.id] }),
}));

export const listingTermsRelations = relations(listingTerms, ({ one }) => ({
  listing: one(listings, { fields: [listingTerms.listingId], references: [listings.id] }),
}));

export const listingLeaseTermsRelations = relations(listingLeaseTerms, ({ one }) => ({
  listing: one(listings, { fields: [listingLeaseTerms.listingId], references: [listings.id] }),
}));

export const listingBusinessRelations = relations(listingBusiness, ({ one }) => ({
  listing: one(listings, { fields: [listingBusiness.listingId], references: [listings.id] }),
}));

export const listingDisclosuresRelations = relations(listingDisclosures, ({ one }) => ({
  listing: one(listings, { fields: [listingDisclosures.listingId], references: [listings.id] }),
}));

export const listingConfidentialRelations = relations(listingConfidential, ({ one }) => ({
  listing: one(listings, { fields: [listingConfidential.listingId], references: [listings.id] }),
}));

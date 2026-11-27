package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.auth.AccountRepository;
import com.kyf.knowyourfinance.auth.SecurityConfiguration;
import com.kyf.knowyourfinance.model.SavingsGoal;
import com.kyf.knowyourfinance.repository.SavingsGoalRepository;
import com.kyf.knowyourfinance.repository.SubscriptionDecisionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FinancialPlanningController.class)
@Import(SecurityConfiguration.class)
@AuthenticatedTestAccount
class FinancialPlanningControllerTest {
    private static final String GOAL = """
            {"name":"Emergency fund","targetAmount":1000,"savedAmount":250,"deadline":"2027-06-30","ownerId":999}
            """;

    @Autowired MockMvc mvc;
    @MockitoBean SavingsGoalRepository goals;
    @MockitoBean SubscriptionDecisionRepository decisions;
    @MockitoBean AccountRepository accounts;

    @Test
    void planningRequiresAuthenticationAndMutationsRequireCsrf() throws Exception {
        mvc.perform(get("/api/planning/goals").with(anonymous())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/planning/goals").contentType(MediaType.APPLICATION_JSON).content(GOAL))
                .andExpect(status().isForbidden());
        verifyNoInteractions(goals);
    }

    @Test
    void goalCreationValidatesAmountsAndOmitsInternalOwnerId() throws Exception {
        when(goals.save(any(SavingsGoal.class))).thenAnswer(call -> call.getArgument(0));
        mvc.perform(post("/api/planning/goals").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(GOAL.replace("1000", "-1000")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/planning/goals").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(GOAL))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Emergency fund"))
                .andExpect(jsonPath("$.ownerId").doesNotExist());
        verify(goals).save(any(SavingsGoal.class));
    }

    @Test
    void updateAndDeleteLookUpTheGoalOnlyWithinTheSignedInAccount() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(put("/api/planning/goals/{id}", id).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(GOAL))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/planning/goals/{id}", id).with(csrf()))
                .andExpect(status().isNotFound());
        verify(goals, times(2)).findByIdAndOwnerId(id, 1L);
        verify(goals, never()).delete(any());
    }
}

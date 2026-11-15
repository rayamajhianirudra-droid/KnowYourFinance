package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.model.UserProfile;
import com.kyf.knowyourfinance.repository.UserProfileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProfileController.class)
class ProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserProfileRepository repository;

    @Test
    void returnsAnEmptyNameBeforeOneIsSaved() throws Exception {
        when(repository.findById(1L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/profile").param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").doesNotExist());
    }

    @Test
    void returnsTheSavedName() throws Exception {
        when(repository.findById(1L)).thenReturn(Optional.of(new UserProfile(1L, "Ada Lovelace")));

        mockMvc.perform(get("/api/profile").param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Ada Lovelace"));
    }

    @Test
    void savesANameAfterTidyingTheSpaces() throws Exception {
        when(repository.findById(1L)).thenReturn(Optional.empty());
        when(repository.save(any(UserProfile.class))).thenAnswer(call -> call.getArgument(0));

        mockMvc.perform(put("/api/profile").param("userId", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\": \"  Ada    Lovelace \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Ada Lovelace"));
    }

    @Test
    void rejectsABlankName() throws Exception {
        mockMvc.perform(put("/api/profile").param("userId", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\": \"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.fullName").value("Enter your full name."));

        verify(repository, never()).save(any());
    }
}

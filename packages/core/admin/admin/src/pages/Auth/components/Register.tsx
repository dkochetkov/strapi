import * as React from 'react';

import { Box, Button, Flex, Grid, GridItem, Main, Typography } from '@strapi/design-system';
import { Link } from '@strapi/design-system/v2';
import {
  auth,
  translatedErrors,
  useAPIErrorHandler,
  useGuidedTour,
  useNotification,
  useQuery,
  useTracking,
} from '@strapi/helper-plugin';
import omit from 'lodash/omit';
import { useIntl } from 'react-intl';
import { NavLink, Navigate, useNavigate, useMatch } from 'react-router-dom';
import styled from 'styled-components';
import * as yup from 'yup';
import { ValidationError } from 'yup';

import {
  Register as RegisterUser,
  RegisterAdmin,
} from '../../../../../shared/contracts/authentication';
import { Form, FormHelpers } from '../../../components/Form';
import { InputRenderer } from '../../../components/FormInputs/Renderer';
import { useNpsSurveySettings } from '../../../components/NpsSurvey';
import { Logo } from '../../../components/UnauthenticatedLogo';
import { useAuth } from '../../../features/Auth';
import { LayoutContent, UnauthenticatedLayout } from '../../../layouts/UnauthenticatedLayout';
import {
  useGetRegistrationInfoQuery,
  useRegisterAdminMutation,
  useRegisterUserMutation,
} from '../../../services/auth';
import { isBaseQueryError } from '../../../utils/baseQuery';

const REGISTER_USER_SCHEMA = yup.object().shape({
  firstname: yup.string().trim().required({
    id: translatedErrors.required,
    defaultMessage: 'Firstname is required',
  }),
  lastname: yup.string().nullable(),
  password: yup
    .string()
    .min(8, {
      id: translatedErrors.minLength,
      defaultMessage: 'Password must be at least 8 characters',
      values: { min: 8 },
    })
    .matches(/[a-z]/, {
      message: {
        id: 'components.Input.error.contain.lowercase',
        defaultMessage: 'Password must contain at least 1 lowercase letter',
      },
    })
    .matches(/[A-Z]/, {
      message: {
        id: 'components.Input.error.contain.uppercase',
        defaultMessage: 'Password must contain at least 1 uppercase letter',
      },
    })
    .matches(/\d/, {
      message: {
        id: 'components.Input.error.contain.number',
        defaultMessage: 'Password must contain at least 1 number',
      },
    })
    .required({
      id: translatedErrors.required,
      defaultMessage: 'Password is required',
    }),
  confirmPassword: yup
    .string()
    .required({
      id: translatedErrors.required,
      defaultMessage: 'Confirm password is required',
    })
    .oneOf([yup.ref('password'), null], {
      id: 'components.Input.error.password.noMatch',
      defaultMessage: 'Passwords must match',
    }),
  registrationToken: yup.string().required({
    id: translatedErrors.required,
    defaultMessage: 'Registration token is required',
  }),
});

const REGISTER_ADMIN_SCHEMA = yup.object().shape({
  firstname: yup.string().trim().required({
    id: translatedErrors.required,
    defaultMessage: 'Firstname is required',
  }),
  lastname: yup.string().nullable(),
  password: yup
    .string()
    .min(8, {
      id: translatedErrors.minLength,
      defaultMessage: 'Password must be at least 8 characters',
      values: { min: 8 },
    })
    .matches(/[a-z]/, {
      message: {
        id: 'components.Input.error.contain.lowercase',
        defaultMessage: 'Password must contain at least 1 lowercase letter',
      },
    })
    .matches(/[A-Z]/, {
      message: {
        id: 'components.Input.error.contain.uppercase',
        defaultMessage: 'Password must contain at least 1 uppercase letter',
      },
    })
    .matches(/\d/, {
      message: {
        id: 'components.Input.error.contain.number',
        defaultMessage: 'Password must contain at least 1 number',
      },
    })
    .required({
      id: translatedErrors.required,
      defaultMessage: 'Password is required',
    }),
  confirmPassword: yup
    .string()
    .required({
      id: translatedErrors.required,
      defaultMessage: 'Confirm password is required',
    })
    .oneOf([yup.ref('password'), null], {
      id: 'components.Input.error.password.noMatch',
      defaultMessage: 'Passwords must match',
    }),
  email: yup
    .string()
    .email({
      id: translatedErrors.email,
      defaultMessage: 'Not a valid email',
    })
    .strict()
    .lowercase({
      id: translatedErrors.lowercase,
      defaultMessage: 'Email must be lowercase',
    })
    .required({
      id: translatedErrors.required,
      defaultMessage: 'Email is required',
    }),
});

interface RegisterProps {
  hasAdmin?: boolean;
}

interface RegisterFormValues {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  confirmPassword: string;
  registrationToken: string | undefined;
  news: boolean;
}

const Register = ({ hasAdmin }: RegisterProps) => {
  const toggleNotification = useNotification();
  const navigate = useNavigate();
  const [submitCount, setSubmitCount] = React.useState(0);
  const [apiError, setApiError] = React.useState<string>();
  const { trackUsage } = useTracking();
  const { formatMessage } = useIntl();
  const { setSkipped } = useGuidedTour();
  const query = useQuery();
  const match = useMatch('/auth/:authType');
  const {
    _unstableFormatAPIError: formatAPIError,
    _unstableFormatValidationErrors: formatValidationErrors,
  } = useAPIErrorHandler();
  const { setNpsSurveySettings } = useNpsSurveySettings();

  const registrationToken = query.get('registrationToken');

  const { data: userInfo, error } = useGetRegistrationInfoQuery(registrationToken as string, {
    skip: !registrationToken,
  });

  React.useEffect(() => {
    if (error) {
      const message: string = isBaseQueryError(error) ? formatAPIError(error) : error.message ?? '';

      toggleNotification({
        type: 'warning',
        message,
      });

      navigate(`/auth/oops?info=${encodeURIComponent(message)}`);
    }
  }, [error, formatAPIError, navigate, toggleNotification]);

  const [registerAdmin] = useRegisterAdminMutation();
  const [registerUser] = useRegisterUserMutation();
  const setToken = useAuth('Register', (state) => state.setToken);

  const handleRegisterAdmin = async (
    { news, ...body }: RegisterAdmin.Request['body'] & { news: boolean },
    setFormErrors: FormHelpers<RegisterFormValues>['setErrors']
  ) => {
    const res = await registerAdmin(body);

    if ('data' in res) {
      setToken(res.data.token);

      const { roles } = res.data.user;

      if (roles) {
        const isUserSuperAdmin = roles.find(({ code }) => code === 'strapi-super-admin');

        if (isUserSuperAdmin) {
          auth.set(false, 'GUIDED_TOUR_SKIPPED', true);
          setSkipped(false);
          trackUsage('didLaunchGuidedtour');
        }
      }

      if (news) {
        // Only enable EE survey if user accepted the newsletter
        setNpsSurveySettings((s) => ({ ...s, enabled: true }));

        navigate({
          pathname: '/usecase',
          search: `?hasAdmin=${true}`,
        });
      } else {
        navigate('/');
      }
    } else {
      if (isBaseQueryError(res.error)) {
        trackUsage('didNotCreateFirstAdmin');

        if (res.error.name === 'ValidationError') {
          setFormErrors(formatValidationErrors(res.error));
          return;
        }

        setApiError(formatAPIError(res.error));
      }
    }
  };

  const handleRegisterUser = async (
    { news, ...body }: RegisterUser.Request['body'] & { news: boolean },
    setFormErrors: FormHelpers<RegisterFormValues>['setErrors']
  ) => {
    const res = await registerUser(body);

    if ('data' in res) {
      setToken(res.data.token);

      if (news) {
        // Only enable EE survey if user accepted the newsletter
        setNpsSurveySettings((s) => ({ ...s, enabled: true }));

        navigate({
          pathname: '/usecase',
          search: `?hasAdmin=${hasAdmin}`,
        });
      } else {
        navigate('/');
      }
    } else {
      if (isBaseQueryError(res.error)) {
        trackUsage('didNotCreateFirstAdmin');

        if (res.error.name === 'ValidationError') {
          setFormErrors(formatValidationErrors(res.error));
          return;
        }

        setApiError(formatAPIError(res.error));
      }
    }
  };

  if (
    !match ||
    (match.params.authType !== 'register' && match.params.authType !== 'register-admin')
  ) {
    return <Navigate to="/" />;
  }

  const isAdminRegistration = match.params.authType === 'register-admin';

  const schema = isAdminRegistration ? REGISTER_ADMIN_SCHEMA : REGISTER_USER_SCHEMA;

  return (
    <UnauthenticatedLayout>
      <LayoutContent>
        <Flex direction="column" alignItems="center" gap={3}>
          <Logo />

          <Typography as="h1" variant="alpha" textAlign="center">
            {formatMessage({
              id: 'Auth.form.welcome.title',
              defaultMessage: 'Welcome to Strapi!',
            })}
          </Typography>
          <Typography variant="epsilon" textColor="neutral600" textAlign="center">
            {formatMessage({
              id: 'Auth.form.register.subtitle',
              defaultMessage:
                'Credentials are only used to authenticate in Strapi. All saved data will be stored in your database.',
            })}
          </Typography>
          {apiError ? (
            <Typography id="global-form-error" role="alert" tabIndex={-1} textColor="danger600">
              {apiError}
            </Typography>
          ) : null}
        </Flex>
        <Form
          method="POST"
          initialValues={
            {
              firstname: userInfo?.firstname || '',
              lastname: userInfo?.lastname || '',
              email: userInfo?.email || '',
              password: '',
              confirmPassword: '',
              registrationToken: registrationToken || undefined,
              news: false,
            } satisfies RegisterFormValues
          }
          onSubmit={async (data, helpers) => {
            const normalizedData = normalizeData(data);

            try {
              await schema.validate(normalizedData, { abortEarly: false });

              if (submitCount > 0 && isAdminRegistration) {
                trackUsage('didSubmitWithErrorsFirstAdmin', { count: submitCount.toString() });
              }

              if (normalizedData.registrationToken) {
                handleRegisterUser(
                  {
                    userInfo: omit(normalizedData, [
                      'registrationToken',
                      'confirmPassword',
                      'email',
                      'news',
                    ]),
                    registrationToken: normalizedData.registrationToken,
                    news: normalizedData.news,
                  },
                  helpers.setErrors
                );
              } else {
                await handleRegisterAdmin(
                  omit(normalizedData, ['registrationToken', 'confirmPassword']),
                  helpers.setErrors
                );
              }
            } catch (err) {
              if (err instanceof ValidationError) {
                helpers.setErrors(
                  err.inner.reduce<Record<string, string>>((acc, { message, path }) => {
                    if (path && typeof message === 'object') {
                      acc[path] = formatMessage(message);
                    }
                    return acc;
                  }, {})
                );
              }
              setSubmitCount(submitCount + 1);
            }
          }}
        >
          <Flex direction="column" alignItems="stretch" gap={6} marginTop={7}>
            <Grid gap={4}>
              {[
                {
                  label: formatMessage({
                    id: 'Auth.form.firstname.label',
                    defaultMessage: 'Firstname',
                  }),
                  name: 'firstname',
                  required: true,
                  size: 6,
                  type: 'string' as const,
                },
                {
                  label: formatMessage({
                    id: 'Auth.form.lastname.label',
                    defaultMessage: 'Lastname',
                  }),
                  name: 'lastname',
                  size: 6,
                  type: 'string' as const,
                },
                {
                  disabled: !isAdminRegistration,
                  label: formatMessage({
                    id: 'Auth.form.email.label',
                    defaultMessage: 'Email',
                  }),
                  name: 'email',
                  required: true,
                  size: 12,
                  type: 'email' as const,
                },
                {
                  hint: formatMessage({
                    id: 'Auth.form.password.hint',
                    defaultMessage:
                      'Must be at least 8 characters, 1 uppercase, 1 lowercase & 1 number',
                  }),
                  label: formatMessage({
                    id: 'global.password',
                    defaultMessage: 'Password',
                  }),
                  name: 'password',
                  required: true,
                  size: 12,
                  type: 'password' as const,
                },
                {
                  label: formatMessage({
                    id: 'Auth.form.confirmPassword.label',
                    defaultMessage: 'Confirm Password',
                  }),
                  name: 'confirmPassword',
                  required: true,
                  size: 12,
                  type: 'password' as const,
                },
                {
                  label: formatMessage(
                    {
                      id: 'Auth.form.register.news.label',
                      defaultMessage:
                        'Keep me updated about new features & upcoming improvements (by doing this you accept the {terms} and the {policy}).',
                    },
                    {
                      terms: (
                        <A target="_blank" href="https://strapi.io/terms" rel="noreferrer">
                          {formatMessage({
                            id: 'Auth.privacy-policy-agreement.terms',
                            defaultMessage: 'terms',
                          })}
                        </A>
                      ),
                      policy: (
                        <A target="_blank" href="https://strapi.io/privacy" rel="noreferrer">
                          {formatMessage({
                            id: 'Auth.privacy-policy-agreement.policy',
                            defaultMessage: 'policy',
                          })}
                        </A>
                      ),
                    }
                  ),
                  name: 'news',
                  size: 12,
                  type: 'checkbox' as const,
                },
              ].map(({ size, ...field }) => (
                <GridItem key={field.name} col={size}>
                  <InputRenderer {...field} />
                </GridItem>
              ))}
            </Grid>
            <Button fullWidth size="L" type="submit">
              {formatMessage({
                id: 'Auth.form.button.register',
                defaultMessage: "Let's start",
              })}
            </Button>
          </Flex>
        </Form>
        {match?.params.authType === 'register' && (
          <Box paddingTop={4}>
            <Flex justifyContent="center">
              {/* @ts-expect-error – error with inferring the props from the as component */}
              <Link as={NavLink} to="/auth/login">
                {formatMessage({
                  id: 'Auth.link.signin.account',
                  defaultMessage: 'Already have an account?',
                })}
              </Link>
            </Flex>
          </Box>
        )}
      </LayoutContent>
    </UnauthenticatedLayout>
  );
};

interface RegisterFormValues {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  confirmPassword: string;
  registrationToken: string | undefined;
  news: boolean;
}

type StringKeys<T> = {
  [K in keyof T]: T[K] extends string | undefined ? K : never;
}[keyof T];

/**
 * @description Trims all values but the password & sets lastName to null if it's a falsey value.
 */
function normalizeData(data: RegisterFormValues) {
  return Object.entries(data).reduce(
    (acc, [key, value]) => {
      type PasswordKeys = Extract<keyof RegisterFormValues, 'password' | 'confirmPassword'>;
      type RegisterFormStringValues = Exclude<
        keyof Pick<RegisterFormValues, StringKeys<RegisterFormValues>>,
        PasswordKeys
      >;

      if (!['password', 'confirmPassword'].includes(key) && typeof value === 'string') {
        acc[key as RegisterFormStringValues] = value.trim();

        if (key === 'lastname') {
          acc[key] = value || undefined;
        }
      } else {
        acc[key as PasswordKeys] = value;
      }

      return acc;
    },
    {} as {
      firstname: string;
      lastname: string | undefined;
      email: string;
      password: string;
      confirmPassword: string;
      registrationToken: string | undefined;
      news: boolean;
    }
  );
}

const A = styled.a`
  color: ${({ theme }) => theme.colors.primary600};
`;

export { Register };
export type { RegisterProps };